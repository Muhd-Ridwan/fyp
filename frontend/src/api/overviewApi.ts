import type { OverviewResponse } from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

export async function getOverview(idToken: string): Promise<OverviewResponse> {
  const response = await fetch(`${getApiBaseUrl()}/overview`, {
    headers: authHeaders(idToken),
  });
  return handleResponse<OverviewResponse>(response);
}
