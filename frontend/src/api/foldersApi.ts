/**
 * API client for folder management endpoints.
 * API calls attach the Cognito ID token as Bearer header
 */

import type { Folder, FolderListResponse } from "../types";
import { getApiBaseUrl, authHeaders, handleResponse } from "./utils";

// CREATE
export async function createFolder(
  idToken: string,
  name: string,
  parentFolderId?: string,
): Promise<Folder> {
  const response = await fetch(`${getApiBaseUrl()}/folders`, {
    method: "POST",
    headers: {
      ...authHeaders(idToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parent_folder_id: parentFolderId ?? null }),
  });
  return handleResponse<Folder>(response);
}

// LIST

export async function listFolders(
  idToken: string,
  parentFolderId?: string,
): Promise<FolderListResponse> {
  const url = new URL(`${getApiBaseUrl()}/folders`);
  if (parentFolderId) url.searchParams.set("parent_folder_id", parentFolderId);

  const response = await fetch(url.toString(), {
    headers: authHeaders(idToken),
  });
  return handleResponse<FolderListResponse>(response);
}

// RENAME

export async function renameFolder(
  idToken: string,
  folderId: string,
  name: string,
): Promise<{ folder_id: string; name: string }> {
  const response = await fetch(
    `${getApiBaseUrl()}/folders/${folderId}/rename`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(idToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  return handleResponse(response);
}

// DELETE

export async function deleteFolder(
  idToken: string,
  folderId: string,
): Promise<{ folder_id: string; deleted: boolean; files_deleted: number }> {
  const response = await fetch(`${getApiBaseUrl()}/folders/${folderId}`, {
    method: "DELETE",
    headers: authHeaders(idToken),
  });
  return handleResponse(response);
}
