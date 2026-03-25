export type SyncStatus =
  | "idle"
  | "editing"
  | "saving"
  | "saved-local"
  | "saved-cloud"
  | "error";

export interface FolderRecord {
  id: string;
  ownerId: string | null;
  name: string;
  parentId: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
  lastSyncedAt: string | null;
}

export interface SnippetRecord {
  id: string;
  ownerId: string | null;
  folderId: string | null;
  title: string;
  code: string;
  language: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
  lastSyncedAt: string | null;
}

export interface WorkspaceSnapshot {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
}

export interface SyncResult {
  syncedFolderIds: string[];
  syncedSnippetIds: string[];
}

export interface CloudFolderRow {
  id: string;
  owner_id: string;
  name: string;
  parent_id: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudSnippetRow {
  id: string;
  owner_id: string;
  folder_id: string | null;
  title: string;
  code: string;
  language: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}