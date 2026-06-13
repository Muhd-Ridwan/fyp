/**
 * Calls to the FYP Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface EmployeeProfile {
  email: string;
  name: string;
  department: string;
  role: string;
}

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
