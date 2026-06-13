/**
 * Cognito User Pool Configuration.
 *
 * Values come from Vite environment variables
 * project root, prefixed with VITE_ so Vite exposes them to client code
 */

export const cognitoConfig = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
};

if (!cognitoConfig.UserPoolId || !cognitoConfig.ClientId) {
  console.error(
    "Missing Vite cognito user pool id or vite cognito client id. " +
      "Check frontend env exists and restart dev server",
  );
}
