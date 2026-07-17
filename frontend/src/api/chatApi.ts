import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";
import type { Message } from "../types";

export async function askQuestion(
  idToken: string,
  question: string,
  history: Message[] = [],
  fileId?: string,
): Promise<{ answer: string }> {
  const response = await fetch(`${getApiBaseUrl()}/chat`, {
    method: "POST",
    headers: {
      ...authHeaders(idToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      file_id: fileId ?? null,
    }),
  });
  return handleResponse<{ answer: string }>(response);
}

export async function exportChat(
  idToken: string,
  messages: Message[],
): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}/chat/export`, {
    method: "POST",
    headers: {
      ...authHeaders(idToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      `${response.status}: ${body?.detail ?? response.statusText}`,
    );
  }
  return response.blob();
}
