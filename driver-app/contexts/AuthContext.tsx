import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getProfile, signOut as supabaseSignOut, supabase, type UserProfile } from "../lib/supabase";
import { clearAuthToken, setAuthToken } from "../services/api";
import { diagLogger } from "../utils/diagLog";

export type AuthState = 'BOOTSTRAPPING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

type AuthContextType = {
  authUser: User | null;
  user: UserProfile | null | undefined;
  loading: boolean;
  authState: AuthState;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  user: undefined,
  loading: true,
  authState: 'BOOTSTRAPPING',
  isAuthenticated: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<AuthState>('BOOTSTRAPPING');
  const lastAppliedAccessToken = useRef<string | null>(null);
  const sessionVersion = useRef(0);
  const authUserRef = useRef<User | null>(null);
  authUserRef.current = authUser;

  const applySession = useCallback((session: Session | null) => {
    const version = sessionVersion.current + 1;
    sessionVersion.current = version;
    const accessToken = session?.access_token ?? null;

    if (accessToken && accessToken !== lastAppliedAccessToken.current) {
      setAuthToken(accessToken).catch(() => {});
    } else if (!accessToken && lastAppliedAccessToken.current) {
      clearAuthToken().catch(() => {});
    }

    lastAppliedAccessToken.current = accessToken;
    const sessionUser = session?.user ?? null;
    setAuthUser(sessionUser);

    if (!sessionUser) {
      diagLogger.setDriverId(null);
      diagLogger.log('AUTH_SIGNED_OUT', `version=${version}`);
      setUser(null);
      return;
    }

    diagLogger.setDriverId(sessionUser.id);
    diagLogger.log('AUTH_SESSION', `version=${version} user=${sessionUser.id}`);

    getProfile(sessionUser.id)
      .then((profile) => {
        if (sessionVersion.current === version) {
          setUser(profile);
        }
      })
      .catch(() => {
        if (sessionVersion.current === version) {
          setUser(null);
        }
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    let initialResolved = false;
    diagLogger.log('AUTH_BOOTSTRAPPING');

    const resolveInitialAuth = (session: Session | null, source: string) => {
      if (initialResolved) return;
      initialResolved = true;
      const nextState: AuthState = session ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
      diagLogger.log('AUTH_SESSION_RESOLVED', `${source} ${nextState}`);
      if (nextState === 'AUTHENTICATED') diagLogger.log('AUTHENTICATED', `user=${session?.user.id ?? ''}`);
      else diagLogger.log('UNAUTHENTICATED', source);
      applySession(session);
      if (isMounted) {
        setAuthState(nextState);
        setLoading(false);
      }
    };

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          diagLogger.log('AUTH_RESTORE_ERROR', error.message);
          resolveInitialAuth(null, 'getSession:error');
          return;
        }
        diagLogger.setNetwork('UNKNOWN');
        diagLogger.log('AUTH_RESTORE_ATTEMPT', data.session ? 'found-session' : 'no-session');
        resolveInitialAuth(data.session, 'getSession');
      })
      .catch((err) => {
        if (isMounted) {
          diagLogger.log('AUTH_RESTORE_THROW', err instanceof Error ? err.message : String(err));
          resolveInitialAuth(null, 'getSession:throw');
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      diagLogger.log('AUTH_STATE_CHANGE', event);
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') {
        // INITIAL_SESSION races with getSession — use whichever arrives first as authoritative initial decision
        resolveInitialAuth(session, 'INITIAL_SESSION');
        return;
      }
      // Post-bootstrap events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.) update auth without re-entering BOOTSTRAPPING
      if (initialResolved) {
        applySession(session);
        const nextState: AuthState = session ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
        setAuthState(nextState);
        setLoading(false);
      } else {
        // Edge: no INITIAL_SESSION event, getSession still pending — treat as initial
        resolveInitialAuth(session, `onAuthStateChange:${event}`);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    const currentUser = authUserRef.current;
    if (!currentUser) {
      setUser(null);
      return;
    }

    const profile = await getProfile(currentUser.id);
    setUser(profile);
  }, []);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, user, loading, authState, isAuthenticated: authState === 'AUTHENTICATED', refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
