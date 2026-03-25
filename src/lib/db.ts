import Dexie, { type Table } from "dexie";

import type { FolderRecord, SnippetRecord, WorkspaceSnapshot } from "@/lib/types";

class KodeBoardDatabase extends Dexie {
  folders!: Table<FolderRecord, string>;
  snippets!: Table<SnippetRecord, string>;

  constructor() {
    super("kodeboard");

    this.version(1).stores({
      folders: "id, ownerId, parentId, dirty, updatedAt",
      snippets: "id, ownerId, folderId, dirty, updatedAt",
    });
  }
}

export const db = new KodeBoardDatabase();

function matchesOwner(ownerId: string | null, currentUserId: string | null) {
  if (!currentUserId) {
    return ownerId === null;
  }

  return ownerId === null || ownerId === currentUserId;
}

function sortFolders(left: FolderRecord, right: FolderRecord) {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function sortSnippets(left: SnippetRecord, right: SnippetRecord) {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

export async function readWorkspace(
  currentUserId: string | null
): Promise<WorkspaceSnapshot> {
  const [folders, snippets] = await Promise.all([
    db.folders.toArray(),
    db.snippets.toArray(),
  ]);

  return {
    folders: folders.filter((folder) => matchesOwner(folder.ownerId, currentUserId)).sort(sortFolders),
    snippets: snippets
      .filter((snippet) => matchesOwner(snippet.ownerId, currentUserId))
      .sort(sortSnippets),
  };
}

export async function getDirtyWorkspace(
  currentUserId: string
): Promise<WorkspaceSnapshot> {
  const snapshot = await readWorkspace(currentUserId);

  return {
    folders: snapshot.folders.filter((folder) => folder.dirty),
    snippets: snapshot.snippets.filter((snippet) => snippet.dirty),
  };
}