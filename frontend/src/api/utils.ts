/**
 * Shared API util across API client files.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function authHeaders(idToken: string): HeadersInit {
  return { Authorization: `Bearer ${idToken}` };
}

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail ?? response.statusText;
    throw new Error(`${response.status}: ${detail}`);
  }
  return response.json();
}
