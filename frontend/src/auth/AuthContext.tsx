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
  type LoginResult,
} from "./authClient";
import { fetchCurrentEmployee, logLogin } from "../api";
import type { EmployeeProfile } from "../types";

export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresOnboarding: boolean;
  tokens: AuthTokens | null;
  profile: EmployeeProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  finalizeSession: (tokens: AuthTokens) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);

  // On first load, try restore previous session
  useEffect(() => {
    (async () => {
      const restored = await getCurrentSession();
      if (restored) {
        try {
          const employeeProfile = await fetchCurrentEmployee(restored.idToken);
          setTokens(restored);
          setProfile(employeeProfile);
        } catch (err) {
          console.warn("Session restore failed:", err);
          cognitoLogout();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const result: LoginResult = await cognitoLogin(email, password);
    if (result.type === "NEW_PASSWORD_REQUIRED") {
      setRequiresOnboarding(true);
      return;
    }
    const employeeProfile = await fetchCurrentEmployee(result.tokens.idToken);
    setTokens(result.tokens);
    setProfile(employeeProfile);
    void logLogin(result.tokens.idToken);
  }

  async function finalizeSession(newTokens: AuthTokens) {
    const employeeProfile = await fetchCurrentEmployee(newTokens.idToken);
    setTokens(newTokens);
    setProfile(employeeProfile);
    setRequiresOnboarding(false);
    void logLogin(newTokens.idToken);
  }

  function logout() {
    cognitoLogout();
    setTokens(null);
    setProfile(null);
    setRequiresOnboarding(false);
  }

  const value: AuthContextValue = {
    isLoading,
    isAuthenticated: tokens !== null && profile !== null,
    requiresOnboarding,
    tokens,
    profile,
    login,
    logout,
    finalizeSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
