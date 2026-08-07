import Dexie, { type Table } from "dexie";

import type {
  FolderRecord,
  SnippetRecord,
  TombstoneRecord,
  WorkspaceSnapshot,
} from "@/lib/types";

/**
 * Shape of folder/snippet records as written by versions prior to v4: a single
 * `isPinned` flag and, briefly in v3, a `pinType` discriminator. Both were
 * folded into the `isPinnedAside` / `isPinnedHome` booleans.
 */
type LegacyFolderRecord = FolderRecord & { isPinned?: boolean; pinType?: string };
type LegacySnippetRecord = SnippetRecord & { isPinned?: boolean; pinType?: string };

class KlipCodeDatabase extends Dexie {
  folders!: Table<FolderRecord, string>;
  snippets!: Table<SnippetRecord, string>;
  tombstones!: Table<TombstoneRecord, string>;

  constructor() {
    super("klipcode");

    this.version(1).stores({
      folders: "id, ownerId, parentId, dirty, updatedAt",
      snippets: "id, ownerId, folderId, dirty, updatedAt",
    });

    this.version(2)
      .stores({
        folders: "id, ownerId, parentId, dirty, updatedAt, isPinnedAside, isPinnedHome",
        snippets: "id, ownerId, folderId, dirty, updatedAt, isPinnedAside, isPinnedHome",
      })
      .upgrade((tx) => {
        return Promise.all([
          tx
            .table<FolderRecord & { isPinned?: boolean }>("folders")
            .toCollection()
            .modify((folder) => {
              folder.isPinnedAside = Boolean(folder.isPinned);
              folder.isPinnedHome = false;
              delete folder.isPinned;
            }),
          tx
            .table<SnippetRecord & { isPinned?: boolean }>("snippets")
            .toCollection()
            .modify((snippet) => {
              snippet.isPinnedAside = Boolean(snippet.isPinned);
              snippet.isPinnedHome = false;
              delete snippet.isPinned;
            }),
        ]);
      });

    this.version(3)
      .stores({
        folders: "id, ownerId, parentId, dirty, updatedAt, isPinnedAside, isPinnedHome",
        snippets: "id, ownerId, folderId, dirty, updatedAt, isPinnedAside, isPinnedHome",
      })
      .upgrade((tx) => {
        return Promise.all([
          tx
            .table<LegacyFolderRecord>("folders")
            .toCollection()
            .modify((folder) => {
              folder.isPinnedAside = Boolean(folder.isPinnedAside || folder.isPinned || folder.pinType === "pinned");
              folder.isPinnedHome = Boolean(folder.isPinnedHome || folder.pinType === "home");
              delete folder.isPinned;
              delete folder.pinType;
            }),
          tx
            .table<LegacySnippetRecord>("snippets")
            .toCollection()
            .modify((snippet) => {
              snippet.isPinnedAside = Boolean(snippet.isPinnedAside || snippet.isPinned || snippet.pinType === "pinned");
              snippet.isPinnedHome = Boolean(snippet.isPinnedHome || snippet.pinType === "home");
              delete snippet.isPinned;
              delete snippet.pinType;
            }),
        ]);
      });

    this.version(4)
      .stores({
        folders: "id, ownerId, parentId, dirty, updatedAt, isPinnedAside, isPinnedHome",
        snippets: "id, ownerId, folderId, dirty, updatedAt, isPinnedAside, isPinnedHome",
      })
      .upgrade((tx) => {
        return Promise.all([
          tx
            .table<LegacyFolderRecord>("folders")
            .toCollection()
            .modify((folder) => {
              folder.isPinnedAside = Boolean(folder.isPinnedAside || folder.isPinned);
              folder.isPinnedHome = Boolean(folder.isPinnedHome);
              delete folder.isPinned;
            }),
          tx
            .table<LegacySnippetRecord>("snippets")
            .toCollection()
            .modify((snippet) => {
              snippet.isPinnedAside = Boolean(snippet.isPinnedAside || snippet.isPinned);
              snippet.isPinnedHome = Boolean(snippet.isPinnedHome);
              delete snippet.isPinned;
            }),
        ]);
      });

    // v5 adds the pending-deletions queue (tombstones). New store only, so no
    // data migration is required for existing records.
    this.version(5).stores({
      folders: "id, ownerId, parentId, dirty, updatedAt, isPinnedAside, isPinnedHome",
      snippets: "id, ownerId, folderId, dirty, updatedAt, isPinnedAside, isPinnedHome",
      tombstones: "id, ownerId",
    });

    // v6 adds the soft-delete `deletedAt` field (local trash). Backfill existing
    // rows to `null` so they're treated as live.
    this.version(6)
      .stores({
        folders: "id, ownerId, parentId, dirty, updatedAt, isPinnedAside, isPinnedHome, deletedAt",
        snippets: "id, ownerId, folderId, dirty, updatedAt, isPinnedAside, isPinnedHome, deletedAt",
        tombstones: "id, ownerId",
      })
      .upgrade((tx) => {
        return Promise.all([
          tx.table<FolderRecord>("folders").toCollection().modify((folder) => {
            folder.deletedAt = null;
          }),
          tx.table<SnippetRecord>("snippets").toCollection().modify((snippet) => {
            snippet.deletedAt = null;
          }),
        ]);
      });
  }
}

export const db = new KlipCodeDatabase();

export function matchesOwner(ownerId: string | null, currentUserId: string | null): boolean {
  if (!currentUserId) {
    return ownerId === null;
  }

  return ownerId === null || ownerId === currentUserId;
}

/**
 * Read every local record that belongs to the active workspace, including trash.
 * Mutations use this instead of unfiltered table scans so a stale clipboard,
 * selection, or shared-device database can never make an account operate on
 * another account's rows.
 */
export async function readAllWorkspaceRecords(
  currentUserId: string | null,
): Promise<WorkspaceSnapshot> {
  const [folders, snippets] = await Promise.all([
    db.folders.toArray(),
    db.snippets.toArray(),
  ]);

  return {
    folders: folders.filter((folder) => matchesOwner(folder.ownerId, currentUserId)),
    snippets: snippets.filter((snippet) => matchesOwner(snippet.ownerId, currentUserId)),
  };
}

function isPinned(record: { isPinnedAside: boolean }) {
  return record.isPinnedAside;
}

function sortFolders(left: FolderRecord, right: FolderRecord) {
  if (isPinned(left) !== isPinned(right)) {
    return isPinned(left) ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function sortSnippets(left: SnippetRecord, right: SnippetRecord) {
  if (isPinned(left) !== isPinned(right)) {
    return isPinned(left) ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

export async function readWorkspace(
  currentUserId: string | null
): Promise<WorkspaceSnapshot> {
  const { folders, snippets } = await readAllWorkspaceRecords(currentUserId);

  return {
    folders: folders
      .filter((folder) => matchesOwner(folder.ownerId, currentUserId) && !folder.deletedAt)
      .sort(sortFolders),
    snippets: snippets
      .filter((snippet) => matchesOwner(snippet.ownerId, currentUserId) && !snippet.deletedAt)
      .sort(sortSnippets),
  };
}

/**
 * Read the trashed (soft-deleted) records for the current owner, newest deletion
 * first. It holds rows whose `deletedAt` is set, which `readWorkspace` excludes
 * from the normal workspace; the field is also synced to the cloud.
 */
export async function readTrash(
  currentUserId: string | null
): Promise<WorkspaceSnapshot> {
  const { folders, snippets } = await readAllWorkspaceRecords(currentUserId);

  const byDeletedAtDesc = <T extends { deletedAt: string | null }>(left: T, right: T) =>
    (right.deletedAt ?? "").localeCompare(left.deletedAt ?? "");

  return {
    folders: folders
      .filter((folder) => matchesOwner(folder.ownerId, currentUserId) && !!folder.deletedAt)
      .sort(byDeletedAtDesc),
    snippets: snippets
      .filter((snippet) => matchesOwner(snippet.ownerId, currentUserId) && !!snippet.deletedAt)
      .sort(byDeletedAtDesc),
  };
}

export async function getDirtyWorkspace(
  currentUserId: string
): Promise<WorkspaceSnapshot> {
  // Reads directly (not via readWorkspace) so trashed records are included: a
  // soft delete sets `dirty` + `deletedAt` and must be uploaded so the trash
  // syncs to the cloud and other devices.
  const { folders, snippets } = await readAllWorkspaceRecords(currentUserId);

  return {
    folders: folders
      .filter((folder) => folder.dirty && matchesOwner(folder.ownerId, currentUserId))
      .sort(sortFolders),
    snippets: snippets
      .filter((snippet) => snippet.dirty && matchesOwner(snippet.ownerId, currentUserId))
      .sort(sortSnippets),
  };
}

export async function getPendingTombstones(
  currentUserId: string
): Promise<TombstoneRecord[]> {
  return db.tombstones.where("ownerId").equals(currentUserId).toArray();
}

/**
 * Remove every local record owned by a user, plus any queued deletions. Used on
 * sign-out so personal data doesn't linger in IndexedDB on a shared machine.
 * Anonymous/seeded records (`ownerId === null`) are left untouched. Cloud-synced
 * data is recovered from the cloud on the next sign-in.
 */
export async function clearOwnedData(userId: string): Promise<void> {
  await Promise.all([
    db.folders.where("ownerId").equals(userId).delete(),
    db.snippets.where("ownerId").equals(userId).delete(),
    db.tombstones.where("ownerId").equals(userId).delete(),
  ]);
}
