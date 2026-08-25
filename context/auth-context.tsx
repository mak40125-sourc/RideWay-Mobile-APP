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

  // Supabase fires both getSession() (restoreSession below) and an
  // INITIAL_SESSION event through onAuthStateChange at startup. Both funnel
  // into applySession; this slot guarantees at most ONE getProfile() request
  // per user + access token instead of two concurrent duplicates.
  const profileFetchRef = useRef<{
    userId: string;
    accessToken: string;
    promise: Promise<UserProfile | null>;
  } | null>(null);

  const fetchProfileShared = useCallback((userId: string, accessToken: string) => {
    const cached = profileFetchRef.current;
    if (cached && cached.userId === userId && cached.accessToken === accessToken) {
      return cached.promise;
    }

    // The entry is intentionally kept after resolution so a duplicate
    // applySession for the same session reuses it; a new access token or an
    // explicit refreshProfile() overwrites the slot with a fresh request.
    const promise = getProfile(userId);
    profileFetchRef.current = { userId, accessToken, promise };
    return promise;
  }, []);

  const applySession = useCallback(async (session: Session | null) => {
    const version = sessionVersion.current + 1;
    sessionVersion.current = version;
    const accessToken = session?.access_token ?? null;

    // The AsyncStorage mirror write starts immediately but runs in parallel
    // with the profile fetch; both are awaited before this resolves so the
    // navigator never unblocks before the mirror is consistent.
    let storageOp: Promise<void> = Promise.resolve();
    if (accessToken && accessToken !== lastAppliedAccessToken.current) {
      storageOp = setAuthToken(accessToken);
    } else if (!accessToken && lastAppliedAccessToken.current) {
      storageOp = clearAuthToken();
    }
    lastAppliedAccessToken.current = accessToken;

    const sessionUser = session?.user ?? null;
    setAuthUser(sessionUser);

    if (!sessionUser) {
      setUser(null);
      await storageOp;
      return;
    }

    try {
      const [profile] = await Promise.all([
        fetchProfileShared(sessionUser.id, accessToken ?? ""),
        storageOp,
      ]);
      if (sessionVersion.current === version) {
        setUser(profile);
      }
    } catch {
      if (sessionVersion.current === version) {
        setUser(null);
      }
    }
  }, [fetchProfileShared]);

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

    // Force a fresh fetch (e.g. right after profile creation): overwrite any
    // cached slot so concurrent applySession calls share this new request
    // instead of starting their own.
    const accessToken = lastAppliedAccessToken.current ?? "";
    const promise = getProfile(currentUser.id);
    profileFetchRef.current = { userId: currentUser.id, accessToken, promise };
    const profile = await promise;
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
