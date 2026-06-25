import type { FullProfile } from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

export async function getProfile(idToken: string): Promise<FullProfile> {
  const response = await fetch(`${getApiBaseUrl()}/profile`, {
    headers: authHeaders(idToken),
  });
  return handleResponse<FullProfile>(response);
}

export async function updateProfile(
  idToken: string,
  address: string,
  phone: string,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(idToken), "Content-Type": "application/json" },
    body: JSON.stringify({ address, phone }),
  });
  return handleResponse(response);
}
