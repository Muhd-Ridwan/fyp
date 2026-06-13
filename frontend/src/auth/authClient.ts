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

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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
export function login(email: string, password: string): Promise<AuthTokens> {
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
      onSuccess: (session) => resolve(sessionToTokens(session)),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => {
        reject(new Error("NEW_PASSWORD_REQUIRED"));
      },
    });
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
