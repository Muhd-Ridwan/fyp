import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

export async function askQuestion(
  idToken: string,
  question: string,
): Promise<{ answer: string }> {
  const response = await fetch(`${getApiBaseUrl()}/chat`, {
    method: "POST",
    headers: {
      ...authHeaders(idToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });
  return handleResponse<{ answer: string }>(response);
}
