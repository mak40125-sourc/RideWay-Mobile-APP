import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, getProfile, supabase, type UserProfile } from "../lib/supabase";

type AuthContextType = {
  authUser: User | null;
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  user: null,
  loading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    
    try {
      const currentAuthUser = await getCurrentUser();
      // Only update authUser if it actually changed to prevent unnecessary re-renders
      if (JSON.stringify(currentAuthUser) !== JSON.stringify(authUser)) {
        setAuthUser(currentAuthUser);
      }

      if (currentAuthUser) {
        const profile = await getProfile(currentAuthUser.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      void loadProfile(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    await loadProfile();
  };

  return (
    <AuthContext.Provider value={{ authUser, user, loading, isAuthenticated: !!authUser, refreshProfile }}>
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
