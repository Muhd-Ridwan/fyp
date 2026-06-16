/**
 * AuthContext - holds the current Cognito session and the employee
 * profile (including department) fetched from backedn
 */

import { createContext, useEffect, useState, type ReactNode } from "react";
import {
  login as cognitoLogin,
  logout as cognitoLogout,
  getCurrentSession,
  type AuthTokens,
} from "./authClient";
import { fetchCurrentEmployee } from "../api";
import type { EmployeeProfile } from "../types";

export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  profile: EmployeeProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);

  // On first load, try restore previous session
  useEffect(() => {
    (async () => {
      const restored = await getCurrentSession();
      if (restored) {
        try {
          const employeeProfile = await fetchCurrentEmployee(restored.idToken);
          setTokens(restored);
          setProfile(employeeProfile);
        } catch {
          cognitoLogout();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const newTokens = await cognitoLogin(email, password);
    const employeeProfile = await fetchCurrentEmployee(newTokens.idToken);
    setTokens(newTokens);
    setProfile(employeeProfile);
  }

  function logout() {
    cognitoLogout();
    setTokens(null);
    setProfile(null);
  }

  const value: AuthContextValue = {
    isLoading,
    isAuthenticated: tokens !== null && profile !== null,
    tokens,
    profile,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
