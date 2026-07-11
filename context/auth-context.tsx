import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getProfile, signOut as supabaseSignOut, supabase, type UserProfile } from "../lib/supabase";
import { clearAuthToken, setAuthToken } from "../services/api";

type AuthContextType = {
  authUser: User | null;
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastAppliedAccessToken = useRef<string | null>(null);
  const sessionVersion = useRef(0);
  const authUserRef = useRef<User | null>(null);
  authUserRef.current = authUser;

  const applySession = useCallback(async (session: Session | null) => {
    const version = sessionVersion.current + 1;
    sessionVersion.current = version;
    const accessToken = session?.access_token ?? null;

    if (accessToken && accessToken !== lastAppliedAccessToken.current) {
      await setAuthToken(accessToken);
    } else if (!accessToken && lastAppliedAccessToken.current) {
      await clearAuthToken();
    }

    lastAppliedAccessToken.current = accessToken;
    const sessionUser = session?.user ?? null;
    setAuthUser(sessionUser);

    if (!sessionUser) {
      setUser(null);
      return;
    }

    try {
      const profile = await getProfile(sessionUser.id);
      if (sessionVersion.current === version) {
        setUser(profile);
      }
    } catch {
      if (sessionVersion.current === version) {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted) {
          await applySession(data.session);
        }
      } catch {
        if (isMounted) {
          await applySession(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
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
    <AuthContext.Provider value={{ authUser, user, loading, isAuthenticated: !!authUser, refreshProfile, signOut }}>
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
