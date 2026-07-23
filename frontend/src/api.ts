/**
 * Calls to the FYP Backend
 */

import type { EmployeeProfile } from "./types";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

/**
 * Calls GET /me on the backend, sending the Cognito ID token as a
 * Bearer token. The backend verifies token, extracts the email,
 * and looks up the matching record in DynamoDB.
 */
export async function fetchCurrentEmployee(
  idToken: string,
): Promise<EmployeeProfile> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail ?? response.statusText;
    throw new Error(`Failed to load profile (${response.status}): ${detail}`);
  }
  return response.json();
}

/**
 * Calls the api to record a login event in audit log
 * The error will be ignored / swallowed to prevent from login fails
 */
export async function logLogin(idToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/log-login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail ?? response.statusText;
    console.warn(`Failed to record login (${response.status}): ${detail}`);
  }
}
