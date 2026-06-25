/**
 * Thin wrapper around amazon-cognito-identity-js for native Cognito
 */

import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { cognitoConfig } from "./cognitoConfig";

const userPool = new CognitoUserPool(cognitoConfig);
let _pendingCognitoUser: CognitoUser | null = null;

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type LoginResult =
  | { type: "SUCCESS"; tokens: AuthTokens }
  | { type: "NEW_PASSWORD_REQUIRED" };

function sessionToTokens(session: CognitoUserSession): AuthTokens {
  const idToken = session.getIdToken();
  return {
    idToken: idToken.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    expiresAt: idToken.getExpiration(),
  };
}

/**
 * Authenticate against Cognito with email + password (SRP flow).
 * Resolves with tokens on success.
 */
export function login(email: string, password: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) =>
        resolve({ type: "SUCCESS", tokens: sessionToTokens(session) }),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => {
        _pendingCognitoUser = cognitoUser;
        resolve({ type: "NEW_PASSWORD_REQUIRED" });
      },
    });
  });
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least 1 uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least 1 lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least 1 number";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least 1 symbol";
  return null;
}

export function completeNewPassword(newPassword: string): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const validationError = validatePassword(newPassword);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    if (!_pendingCognitoUser) {
      reject(new Error("No pending new password challenge"));
      return;
    }
    _pendingCognitoUser.completeNewPasswordChallenge(
      newPassword,
      {},
      {
        onSuccess: (session) => {
          _pendingCognitoUser = null;
          resolve(sessionToTokens(session));
        },
        onFailure: (err) => {
          _pendingCognitoUser = null;
          reject(err);
        },
      },
    );
  });
}

/** Sign out the currently signed-in Cognito user. */
export function logout(): void {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
}

/**
 * Restore a previous session (On refresh)
 * Resolves with tokens if valid
 */
export function getCurrentSession(): Promise<AuthTokens | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(sessionToTokens(session));
      },
    );
  });
}
