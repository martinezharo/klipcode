import type { CloudFolder, CloudSnippet } from "./types";

export interface CloudChanges {
  full: boolean;
  folders: CloudFolder[];
  snippets: CloudSnippet[];
  deletedFolderIds: string[];
  deletedSnippetIds: string[];
  cursor: number;
}

async function request<T>(
  operation: string,
  body?: unknown,
  userId?: string,
): Promise<T> {
  const response = await fetch(`/api/workspace/${operation}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(userId ? { "x-klipcode-account": userId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      (result as { error?: string })?.error ??
        `Cloud request failed (${response.status})`,
    );
  return result as T;
}

export const cloud = {
  changes: (since: number | null, userId: string) =>
    request<CloudChanges>("changes", { since }, userId),
  hasContent: (userId?: string) =>
    request<boolean>("has-content", undefined, userId),
  push: (
    body: { folders: CloudFolder[]; snippets: CloudSnippet[] },
    userId: string,
  ) => request<void>("push", body, userId),
  remove: (
    body: { folderIds: string[]; snippetIds: string[] },
    userId: string,
  ) => request<void>("remove", body, userId),
};
