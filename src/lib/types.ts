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
  isPinnedAside: boolean;
  isPinnedHome: boolean;
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
  lastSyncedAt: string | null;
  /**
   * When set, the record lives in the trash (soft-deleted) and is hidden from
   * the normal workspace. The trash is synced, not device-local: the field is
   * pushed like any other, so a record trashed on one device shows up in the
   * trash on the rest. Only a permanent delete removes the cloud record. `null`
   * means the record is live.
   */
  deletedAt: string | null;
}

export interface SnippetRecord {
  id: string;
  ownerId: string | null;
  folderId: string | null;
  title: string;
  code: string;
  language: string;
  isPinnedAside: boolean;
  isPinnedHome: boolean;
  createdAt: string;
  updatedAt: string;
  dirty: boolean;
  lastSyncedAt: string | null;
  /** See {@link FolderRecord.deletedAt}. */
  deletedAt: string | null;
}

/**
 * A pending cloud deletion. Created when an owned, previously-synced record is
 * deleted locally; removed once the matching cloud row is deleted. While it
 * exists, `fetchCloudWorkspace` won't re-download the row (no resurrection) and
 * the sync loop keeps retrying the cloud delete.
 */
export interface TombstoneRecord {
  id: string;
  kind: "folder" | "snippet";
  ownerId: string;
  deletedAt: string;
}

export interface WorkspaceSnapshot {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
}

export interface SyncResult {
  syncedFolderIds: string[];
  syncedSnippetIds: string[];
  localSnippetIds: string[];
}

/**
 * The signed-in account, as the UI needs it. Kept as our own shape rather than
 * a provider type so the aside and the sync hooks don't depend on the auth
 * library.
 */
export interface AccountUser {
  id: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}

/**
 * A folder as it crosses to the cloud. Identical in shape to the local record
 * minus the device-local bookkeeping (`ownerId`, `dirty`, `lastSyncedAt`) —
 * ownership is taken from the authenticated identity server-side, never sent.
 * The local `id` travels as `clientId`, which is the real key in Convex too.
 */
export interface CloudFolder {
  clientId: string;
  /** Ciphertext when `cryptoVersion` > 0; plaintext when 0. */
  name: string;
  parentId: string | null;
  isPinnedAside: boolean;
  isPinnedHome: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /**
   * Encryption scheme applied to this record's sensitive fields: 0 = plaintext
   * (legacy records, or encryption unavailable), 1 = AES-256-GCM via the
   * per-user DEK (`src/lib/crypto.ts`). Records migrate progressively: every
   * upload writes the current version, so a record is re-encoded when created
   * or edited.
   */
  cryptoVersion: number;
}

/** See {@link CloudFolder}. */
export interface CloudSnippet {
  clientId: string;
  folderId: string | null;
  /** Ciphertext when `cryptoVersion` > 0; plaintext when 0. */
  title: string;
  /** Ciphertext when `cryptoVersion` > 0; plaintext when 0. */
  code: string;
  /** Always plaintext: not sensitive, and used for filtering. */
  language: string;
  isPinnedAside: boolean;
  isPinnedHome: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** See {@link CloudFolder.cryptoVersion}. */
  cryptoVersion: number;
}

/** A workspace item identified by its kind. Shared by multi-selection, batch
 *  mutations and multi-item drag. */
export interface SelectedItem {
  type: "folder" | "snippet";
  id: string;
}

export interface ClipboardItem {
  itemType: "folder" | "snippet";
  id: string;
}

/** The internal cut/copy buffer. Carries one or more items so a multi-selection
 *  can be cut/copied and pasted as a batch. */
export interface ClipboardEntry {
  type: "cut" | "copy";
  items: ClipboardItem[];
}