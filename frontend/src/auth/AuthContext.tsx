/**
 * AuthContext - holds the current Cognito session and the employee
 * profile (including department) fetched from backedn
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  login as cognitoLogin,
  logout as cognitoLogout,
  getCurrentSession,
  type AuthTokens,
} from "./authClient";
import { fetchCurrentEmployee, type EmployeeProfile } from "../api";

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens: AuthTokens | null;
  profile: EmployeeProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used witihn AuthProvider");
  }
  return context;
}
