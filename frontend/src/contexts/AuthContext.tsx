import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getCachedUser,
  getCurrentUser,
  getToken,
} from "../services/apiClient";
import type { AuthUser } from "../types";

type AuthContextValue = {
  checking: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = () => {
      setChecking(true);

      if (!getToken()) {
        setUser(null);
        setChecking(false);
        return;
      }

      const cachedUser = getCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
        setChecking(false);
        return;
      }

      getCurrentUser()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setChecking(false));
    };

    check();
    window.addEventListener("srp-auth-changed", check);
    return () => window.removeEventListener("srp-auth-changed", check);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      checking,
      isAuthenticated: Boolean(user || getToken()),
      user,
    }),
    [checking, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
