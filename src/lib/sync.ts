import { api } from "@convex/_generated/api";
import {
  CRYPTO_VERSION_PLAINTEXT,
  CURRENT_CRYPTO_VERSION,
  decryptString,
  encryptString,
} from "@/lib/crypto";
import { getConvexBrowserClient } from "@/lib/convex";
import { db, getDirtyWorkspace, getPendingTombstones } from "@/lib/db";
import { getWorkspaceEncryptionKey } from "@/lib/encryptionKey";
import type {
  CloudFolder,
  CloudSnippet,
  FolderRecord,
  SnippetRecord,
  SyncCursorRecord,
  SyncResult,
} from "@/lib/types";

// ── Cloud encryption boundary ───────────────────────────────────────────────────
// IndexedDB holds the plaintext working copy used by the guest workspace and
// interrupted connections; only what crosses to Convex is encrypted. With a
// key, uploads
// write ciphertext + `cryptoVersion: 1`; without one (`null` = encryption not
// configured) they write plaintext + version 0, exactly the pre-encryption
// shape. Downloads decode per-record based on `cryptoVersion`, so plaintext
// legacy records and encrypted ones coexist during the progressive migration.

// ── Batching ────────────────────────────────────────────────────────────────────
// A push is normally one round trip: folders and snippets go up in the same
// transaction, so a child folder no longer has to wait for its parent's request
// to land (which is what forced one request per depth level under the old
// Postgres foreign key). Batches exist only to stay under Convex's argument size
// limit — and when a workspace is big enough to need several, folders are
// ordered shallowest-first so a parent is never left for a later batch.
const MAX_BATCH_RECORDS = 500;
const MAX_BATCH_BYTES = 4_000_000;

function chunkBySize<T>(records: T[], sizeOf: (record: T) => number): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let batchBytes = 0;

  for (const record of records) {
    const bytes = sizeOf(record);

    if (bytes > MAX_BATCH_BYTES) {
      throw new Error("A record is too large to sync in one batch");
    }

    if (batch.length > 0 && (batch.length >= MAX_BATCH_RECORDS || batchBytes + bytes > MAX_BATCH_BYTES)) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }

    batch.push(record);
    batchBytes += bytes;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
}

function serializedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/**
 * Whether a fetched record can be decoded here: plaintext always can; ciphertext
 * needs the key and a version this build understands. Undecodable records are
 * skipped — never written locally as garbage, and never treated as deleted
 * (they stay in the cloud id sets used by `reconcileDeletions`).
 */
function canDecodeRecord(cryptoVersion: number, key: CryptoKey | null): boolean {
  if (cryptoVersion === CRYPTO_VERSION_PLAINTEXT) return true;
  return cryptoVersion <= CURRENT_CRYPTO_VERSION && key !== null;
}

function folderDepth(folder: FolderRecord, folderMap: Map<string, FolderRecord>): number {
  let depth = 0;
  let currentParentId = folder.parentId;

  while (currentParentId) {
    const parent = folderMap.get(currentParentId);

    if (!parent) {
      break;
    }

    depth += 1;
    currentParentId = parent.parentId;
  }

  return depth;
}

async function mapFolderToCloud(folder: FolderRecord, key: CryptoKey | null): Promise<CloudFolder> {
  return {
    clientId: folder.id,
    name: key ? await encryptString(key, folder.name) : folder.name,
    parentId: folder.parentId,
    isPinnedAside: folder.isPinnedAside,
    isPinnedHome: folder.isPinnedHome,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    deletedAt: folder.deletedAt,
    cryptoVersion: key ? CURRENT_CRYPTO_VERSION : CRYPTO_VERSION_PLAINTEXT,
  };
}

async function mapSnippetToCloud(
  snippet: SnippetRecord,
  key: CryptoKey | null
): Promise<CloudSnippet> {
  return {
    clientId: snippet.id,
    folderId: snippet.folderId,
    title: key ? await encryptString(key, snippet.title) : snippet.title,
    code: key ? await encryptString(key, snippet.code) : snippet.code,
    language: snippet.language,
    isPinnedAside: snippet.isPinnedAside,
    isPinnedHome: snippet.isPinnedHome,
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
    deletedAt: snippet.deletedAt,
    cryptoVersion: key ? CURRENT_CRYPTO_VERSION : CRYPTO_VERSION_PLAINTEXT,
  };
}

async function mapFolderToLocal(
  folder: CloudFolder,
  userId: string,
  key: CryptoKey | null
): Promise<FolderRecord> {
  const encrypted = folder.cryptoVersion !== CRYPTO_VERSION_PLAINTEXT;
  return {
    id: folder.clientId,
    ownerId: userId,
    name: encrypted ? await decryptString(key!, folder.name) : folder.name,
    parentId: folder.parentId,
    isPinnedAside: folder.isPinnedAside,
    isPinnedHome: folder.isPinnedHome,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    dirty: false,
    lastSyncedAt: folder.updatedAt,
    deletedAt: folder.deletedAt,
  };
}

async function mapSnippetToLocal(
  snippet: CloudSnippet,
  userId: string,
  key: CryptoKey | null
): Promise<SnippetRecord> {
  const encrypted = snippet.cryptoVersion !== CRYPTO_VERSION_PLAINTEXT;
  return {
    id: snippet.clientId,
    ownerId: userId,
    folderId: snippet.folderId,
    title: encrypted ? await decryptString(key!, snippet.title) : snippet.title,
    code: encrypted ? await decryptString(key!, snippet.code) : snippet.code,
    language: snippet.language,
    isPinnedAside: snippet.isPinnedAside,
    isPinnedHome: snippet.isPinnedHome,
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
    dirty: false,
    lastSyncedAt: snippet.updatedAt,
    deletedAt: snippet.deletedAt,
  };
}

async function markFolderAsSynced(folder: FolderRecord, userId: string, syncedAt: string): Promise<boolean> {
  const currentFolder = await db.folders.get(folder.id);

  if (!currentFolder || currentFolder.updatedAt !== folder.updatedAt) {
    return false;
  }

  await db.folders.put({
    ...currentFolder,
    ownerId: userId,
    dirty: false,
    lastSyncedAt: syncedAt,
  });
  return true;
}

async function markSnippetAsSynced(
  snippet: SnippetRecord,
  userId: string,
  syncedAt: string
): Promise<boolean> {
  const currentSnippet = await db.snippets.get(snippet.id);

  if (!currentSnippet || currentSnippet.updatedAt !== snippet.updatedAt) {
    return false;
  }

  await db.snippets.put({
    ...currentSnippet,
    ownerId: userId,
    dirty: false,
    lastSyncedAt: syncedAt,
  });
  return true;
}

/**
 * Settle a snippet that has no cloud counterpart (a brand-new, still-empty
 * placeholder) without claiming a cloud sync. Clearing `dirty` stops the retry
 * loop, while keeping `lastSyncedAt` null marks it as never-uploaded so the
 * deletion reconciliation in `fetchCloudWorkspace` won't mistake it for a record
 * that was deleted remotely.
 */
async function markSnippetSettledLocally(snippet: SnippetRecord): Promise<boolean> {
  const currentSnippet = await db.snippets.get(snippet.id);

  if (!currentSnippet || currentSnippet.updatedAt !== snippet.updatedAt) {
    return false;
  }

  await db.snippets.put({
    ...currentSnippet,
    dirty: false,
  });
  return true;
}

export async function syncDirtyWorkspace(userId: string): Promise<SyncResult> {
  const convex = getConvexBrowserClient();

  if (!convex) {
    return { syncedFolderIds: [], syncedSnippetIds: [], localSnippetIds: [] };
  }

  const dirtyWorkspace = await getDirtyWorkspace(userId);
  const folderMap = new Map(dirtyWorkspace.folders.map((folder) => [folder.id, folder]));
  const syncedFolderIds: string[] = [];
  const syncedSnippetIds: string[] = [];
  const localSnippetIds: string[] = [];

  // Still-empty, never-uploaded placeholders are settled locally instead of
  // uploaded (no cloud record); once a snippet HAS been synced, an empty body is
  // an intentional clear and must be uploaded — otherwise the next fetch
  // resurrects the old content.
  const snippetsToUpload: SnippetRecord[] = [];
  for (const snippet of dirtyWorkspace.snippets) {
    if (!snippet.code.trim() && snippet.lastSyncedAt === null) {
      const marked = await markSnippetSettledLocally(snippet);
      if (marked) localSnippetIds.push(snippet.id);
    } else {
      snippetsToUpload.push(snippet);
    }
  }

  if (dirtyWorkspace.folders.length === 0 && snippetsToUpload.length === 0) {
    return { syncedFolderIds, syncedSnippetIds, localSnippetIds };
  }

  // Resolve the key only when a record will actually cross the network. A new
  // empty placeholder must settle locally even when the key endpoint is
  // temporarily unavailable.
  const encryptionKey = await getWorkspaceEncryptionKey(userId);

  const foldersByDepth = [...dirtyWorkspace.folders].sort(
    (left, right) => folderDepth(left, folderMap) - folderDepth(right, folderMap)
  );

  const folderBatches = chunkBySize(
    await Promise.all(foldersByDepth.map((folder) => mapFolderToCloud(folder, encryptionKey))),
    serializedByteLength
  );
  const snippetBatches = chunkBySize(
    await Promise.all(snippetsToUpload.map((snippet) => mapSnippetToCloud(snippet, encryptionKey))),
    serializedByteLength
  );

  const snippetsById = new Map(snippetsToUpload.map((snippet) => [snippet.id, snippet]));

  // Folders lead so that the batch carrying a snippet's folder has already
  // landed; the pairing is incidental (each call takes whatever is left of both
  // lists) and exists only to keep the common single-batch case at one request.
  const batchCount = Math.max(folderBatches.length, snippetBatches.length);
  const syncedAt = new Date().toISOString();

  for (let index = 0; index < batchCount; index += 1) {
    const folders = folderBatches[index] ?? [];
    const snippets = snippetBatches[index] ?? [];

    await convex.mutation(api.workspace.push, { folders, snippets });

    for (const folder of folders) {
      const local = folderMap.get(folder.clientId);
      if (local && (await markFolderAsSynced(local, userId, syncedAt))) {
        syncedFolderIds.push(folder.clientId);
      }
    }

    for (const snippet of snippets) {
      const local = snippetsById.get(snippet.clientId);
      if (local && (await markSnippetAsSynced(local, userId, syncedAt))) {
        syncedSnippetIds.push(snippet.clientId);
      }
    }
  }

  return { syncedFolderIds, syncedSnippetIds, localSnippetIds };
}

/** What a pull hands back: see `workspace.changes` in convex/workspace.ts. */
interface CloudChanges {
  /** The whole workspace (deletions are reconciled by absence) or only a delta. */
  full: boolean;
  folders: CloudFolder[];
  snippets: CloudSnippet[];
  deletedFolderIds: string[];
  deletedSnippetIds: string[];
  /** Where the next pull resumes; `null` when the result must not be resumed from. */
  cursor: number | null;
}

/**
 * Convex's error when the deployment has no such function: the frontend went
 * out before the backend that defines `workspace.changes`. Any other failure
 * (auth, network) is rethrown so it doesn't turn into a second, full read.
 */
function isMissingFunction(error: unknown): boolean {
  return error instanceof Error && /Could not find (public )?function/i.test(error.message);
}

/**
 * Accounts that already had a full pull in this page load. Records a device
 * cannot decode (a newer `cryptoVersion`, or no key) only become readable
 * after a reload brings a new build or re-probes the key, so one full pull per
 * load is enough to pick them up; every other pull stays incremental.
 */
const fullPullThisLoad = new Set<string>();

/**
 * Where this pull starts: the stored cursor, or `null` for the whole
 * workspace — on a new device, after sign-out, or once per page load while
 * records are still held back as undecodable.
 */
function pullStart(userId: string, stored: SyncCursorRecord | undefined): number | null {
  if (!stored || (stored.heldBack && !fullPullThisLoad.has(userId))) return null;
  return stored.cursor;
}

/**
 * Ask the cloud for what changed since `since`. With no cursor the answer is
 * the whole workspace; after that only what other devices wrote, so a pull
 * costs what changed rather than the size of the workspace.
 */
async function readCloudChanges(
  convex: NonNullable<ReturnType<typeof getConvexBrowserClient>>,
  userId: string,
  since: number | null
): Promise<CloudChanges> {
  try {
    return await convex.query(api.workspace.changes, { since });
  } catch (error) {
    if (!isMissingFunction(error)) throw error;

    // A backend without incremental sync: read everything the old way, and
    // forget the cursor, since writes made there are not stamped for it.
    await db.syncCursors.delete(userId);
    const whole = await convex.query(api.workspace.list, {});
    return { full: true, ...whole, deletedFolderIds: [], deletedSnippetIds: [], cursor: null };
  }
}

export async function fetchCloudWorkspace(userId: string) {
  const convex = getConvexBrowserClient();

  if (!convex) {
    return;
  }

  const stored = await db.syncCursors.get(userId);
  const changes = await readCloudChanges(convex, userId, pullStart(userId, stored));
  const { folders, snippets } = changes;
  if (changes.full) fullPullThisLoad.add(userId);

  // A record we deleted locally but whose cloud delete is still pending must not
  // be re-downloaded, or it would resurrect until the queued delete lands.
  const tombstonedIds = new Set((await getPendingTombstones(userId)).map((t) => t.id));

  // Read the local tables once, diff in memory, then write everything in a single
  // bulkPut per table — instead of a get + put round trip for every cloud record.
  const [localFolders, localSnippets] = await Promise.all([
    db.folders.toArray(),
    db.snippets.toArray(),
  ]);
  const localFolderMap = new Map(localFolders.map((folder) => [folder.id, folder]));
  const localSnippetMap = new Map(localSnippets.map((snippet) => [snippet.id, snippet]));

  // The key is only fetched when some record actually needs decrypting, so
  // plaintext-only workspaces never hit the key endpoint on pull. A transient
  // key failure throws and fails the whole pull (retried later) rather than
  // partially applying it.
  const hasEncryptedRecords =
    folders.some((folder) => folder.cryptoVersion !== CRYPTO_VERSION_PLAINTEXT) ||
    snippets.some((snippet) => snippet.cryptoVersion !== CRYPTO_VERSION_PLAINTEXT);
  const encryptionKey = hasEncryptedRecords ? await getWorkspaceEncryptionKey(userId) : null;

  // Records this device could not decode. They are left alone, and a full pull
  // on the next page load offers them again (see `pullStart`).
  let skipped = 0;

  const foldersToPut: FolderRecord[] = [];
  for (const cloudFolder of folders) {
    if (!canDecodeRecord(cloudFolder.cryptoVersion, encryptionKey)) {
      console.warn(
        `Skipping folder ${cloudFolder.clientId}: undecodable cryptoVersion ${cloudFolder.cryptoVersion}`
      );
      skipped += 1;
      continue;
    }

    let incomingFolder: FolderRecord;
    try {
      incomingFolder = await mapFolderToLocal(cloudFolder, userId, encryptionKey);
    } catch {
      console.warn(`Skipping folder ${cloudFolder.clientId}: decryption failed`);
      skipped += 1;
      continue;
    }

    if (tombstonedIds.has(incomingFolder.id)) {
      continue;
    }

    const currentFolder = localFolderMap.get(incomingFolder.id);

    if (currentFolder?.dirty && currentFolder.updatedAt >= incomingFolder.updatedAt) {
      continue;
    }

    foldersToPut.push(incomingFolder);
  }

  const snippetsToPut: SnippetRecord[] = [];
  for (const cloudSnippet of snippets) {
    if (!canDecodeRecord(cloudSnippet.cryptoVersion, encryptionKey)) {
      console.warn(
        `Skipping snippet ${cloudSnippet.clientId}: undecodable cryptoVersion ${cloudSnippet.cryptoVersion}`
      );
      skipped += 1;
      continue;
    }

    let incomingSnippet: SnippetRecord;
    try {
      incomingSnippet = await mapSnippetToLocal(cloudSnippet, userId, encryptionKey);
    } catch {
      console.warn(`Skipping snippet ${cloudSnippet.clientId}: decryption failed`);
      skipped += 1;
      continue;
    }

    if (tombstonedIds.has(incomingSnippet.id)) {
      continue;
    }

    const currentSnippet = localSnippetMap.get(incomingSnippet.id);

    if (currentSnippet?.dirty && currentSnippet.updatedAt >= incomingSnippet.updatedAt) {
      continue;
    }

    snippetsToPut.push(incomingSnippet);
  }

  if (foldersToPut.length > 0) {
    await db.folders.bulkPut(foldersToPut);
  }

  if (snippetsToPut.length > 0) {
    await db.snippets.bulkPut(snippetsToPut);
  }

  const cloudFolderIds = new Set(folders.map((folder) => folder.clientId));
  const cloudSnippetIds = new Set(snippets.map((snippet) => snippet.clientId));

  if (changes.full) {
    // Reuse the snapshot read above for deletion reconciliation. A record absent
    // from the cloud is unaffected by the puts (which only touch cloud-present
    // records), so the pre-put snapshot yields the correct deletion set.
    await reconcileDeletions(userId, cloudFolderIds, cloudSnippetIds, localFolders, localSnippets);
  } else {
    // A delta lists deletions explicitly. An id that is also among the rows
    // just received was deleted and then written again, so the row wins.
    await applyCloudDeletions(
      userId,
      new Set(changes.deletedFolderIds.filter((id) => !cloudFolderIds.has(id))),
      new Set(changes.deletedSnippetIds.filter((id) => !cloudSnippetIds.has(id))),
      localFolders,
      localSnippets
    );
  }

  if (changes.cursor !== null) {
    // The cursor always moves on, so a record that stays undecodable never
    // makes later pulls re-read an ever-growing window. It is remembered as
    // held back instead, until a full pull (next page load) reads it cleanly.
    const heldBack = skipped > 0 || (!changes.full && Boolean(stored?.heldBack));
    await db.syncCursors.put({ userId, cursor: changes.cursor, ...(heldBack ? { heldBack } : {}) });
  }
}

/** A local record another device's deletion may remove: ours, clean, uploaded before. */
function isRemovableByCloud(record: FolderRecord | SnippetRecord, userId: string): boolean {
  return record.ownerId === userId && !record.dirty && record.lastSyncedAt !== null;
}

/**
 * Apply the permanent deletions an incremental pull reported. Same rules as
 * `reconcileDeletions`: dirty records (unsynced local edits), never-uploaded
 * placeholders and shared/seeded records are kept.
 */
async function applyCloudDeletions(
  userId: string,
  deletedFolderIds: Set<string>,
  deletedSnippetIds: Set<string>,
  localFolders: FolderRecord[],
  localSnippets: SnippetRecord[]
) {
  const foldersToDelete = localFolders
    .filter((folder) => deletedFolderIds.has(folder.id) && isRemovableByCloud(folder, userId))
    .map((folder) => folder.id);

  const snippetsToDelete = localSnippets
    .filter((snippet) => deletedSnippetIds.has(snippet.id) && isRemovableByCloud(snippet, userId))
    .map((snippet) => snippet.id);

  if (foldersToDelete.length > 0) {
    await db.folders.bulkDelete(foldersToDelete);
  }

  if (snippetsToDelete.length > 0) {
    await db.snippets.bulkDelete(snippetsToDelete);
  }
}

/**
 * Propagate remote deletions to this device. A local record that we own, that
 * has no pending local changes, and that we have uploaded before (`lastSyncedAt`
 * is set) but is now absent from the cloud was deleted on another device, so we
 * remove it locally. Dirty records (unsynced local edits), never-uploaded
 * placeholders, and shared/seeded records (`ownerId === null`) are left intact.
 * Trashed records are NOT special-cased: a soft delete keeps the cloud record (with
 * `deletedAt` set), so it stays present here; only a permanent delete removes the
 * cloud record, and that deletion must propagate even if the record is in the trash.
 */
async function reconcileDeletions(
  userId: string,
  cloudFolderIds: Set<string>,
  cloudSnippetIds: Set<string>,
  localFoldersSnapshot?: FolderRecord[],
  localSnippetsSnapshot?: SnippetRecord[]
) {
  const [allFolders, allSnippets] = localFoldersSnapshot && localSnippetsSnapshot
    ? [localFoldersSnapshot, localSnippetsSnapshot]
    : await Promise.all([db.folders.toArray(), db.snippets.toArray()]);

  const foldersToDelete = allFolders
    .filter((folder) => isRemovableByCloud(folder, userId) && !cloudFolderIds.has(folder.id))
    .map((folder) => folder.id);

  const snippetsToDelete = allSnippets
    .filter((snippet) => isRemovableByCloud(snippet, userId) && !cloudSnippetIds.has(snippet.id))
    .map((snippet) => snippet.id);

  if (foldersToDelete.length > 0) {
    await db.folders.bulkDelete(foldersToDelete);
  }

  if (snippetsToDelete.length > 0) {
    await db.snippets.bulkDelete(snippetsToDelete);
  }
}

/**
 * Queue cloud deletions for owned, previously-synced records that were just
 * removed locally. The tombstones are flushed by `syncTombstones` (immediately
 * via the sync loop, and retried if the cloud delete fails).
 */
export async function recordDeletions(
  ownerId: string,
  items: Array<{ id: string; kind: "folder" | "snippet" }>
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const deletedAt = new Date().toISOString();
  await db.tombstones.bulkPut(
    items.map((item) => ({ id: item.id, kind: item.kind, ownerId, deletedAt }))
  );
}

/**
 * Flush queued deletions to the cloud. Folders and snippets are removed in one
 * transaction, so a folder removal can no longer strand a child record even if
 * the process dies mid-flush; the tombstones are cleared only once that
 * transaction commits, and a failure leaves them all queued for the next attempt.
 */
export async function syncTombstones(userId: string): Promise<void> {
  const convex = getConvexBrowserClient();

  if (!convex) {
    return;
  }

  const tombstones = await getPendingTombstones(userId);

  if (tombstones.length === 0) {
    return;
  }

  const snippetIds = tombstones.filter((t) => t.kind === "snippet").map((t) => t.id);
  const folderIds = tombstones.filter((t) => t.kind === "folder").map((t) => t.id);

  await convex.mutation(api.workspace.remove, { folderIds, snippetIds });
  await db.tombstones.bulkDelete([...snippetIds, ...folderIds]);
}

/**
 * Whether the signed-in account already has any cloud records. Distinguishes a
 * brand-new account (the seeded welcome content should be claimed and uploaded)
 * from a returning one (an untouched seed must be discarded, not re-uploaded).
 * A query failure resolves to false so sign-in falls back to claiming — the
 * direction that never destroys data.
 */
async function accountHasCloudContent(): Promise<boolean> {
  const convex = getConvexBrowserClient();

  if (!convex) {
    return false;
  }

  try {
    return await convex.query(api.workspace.hasContent, {});
  } catch {
    return false;
  }
}

/**
 * On sign-in, take over any anonymous (`ownerId === null`) local records by
 * assigning them to the account and marking them dirty so the next push uploads
 * them. Without this, anonymous work stays visible locally but never reaches
 * the cloud or other devices.
 *
 * The seeded welcome content is the exception: it is created `dirty: false`
 * with no `lastSyncedAt`, and since every user action marks a record dirty, a
 * still-pristine anonymous record can only be the untouched seed. For a
 * brand-new account (no cloud records) the seed is claimed like everything else;
 * for a returning account it is deleted locally instead, so signing in from a
 * fresh device doesn't push yet another welcome folder into an existing
 * workspace.
 */
async function claimAnonymousRecords(userId: string): Promise<void> {
  const [folders, snippets] = await Promise.all([
    db.folders.toArray(),
    db.snippets.toArray(),
  ]);

  let anonymousFolders = folders.filter((folder) => folder.ownerId === null);
  let anonymousSnippets = snippets.filter((snippet) => snippet.ownerId === null);

  if (anonymousFolders.length === 0 && anonymousSnippets.length === 0) {
    return;
  }

  const isPristineSeed = (record: FolderRecord | SnippetRecord) =>
    !record.dirty && record.lastSyncedAt === null;

  const hasPristineSeed =
    anonymousFolders.some(isPristineSeed) || anonymousSnippets.some(isPristineSeed);

  if (hasPristineSeed && (await accountHasCloudContent())) {
    const seedSnippetIds = new Set(
      anonymousSnippets.filter(isPristineSeed).map((snippet) => snippet.id)
    );

    // A pristine folder is only dropped when nothing kept (a dirty anonymous
    // record or an owned one) still lives inside it; iterate so parents
    // emptied by a dropped child fall too.
    const remainingSnippets = snippets.filter((snippet) => !seedSnippetIds.has(snippet.id));
    let remainingFolders = folders;
    const seedFolderIds = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of remainingFolders) {
        if (folder.ownerId !== null || !isPristineSeed(folder)) continue;
        const hasChild =
          remainingFolders.some((other) => other.parentId === folder.id) ||
          remainingSnippets.some((snippet) => snippet.folderId === folder.id);
        if (!hasChild) {
          seedFolderIds.add(folder.id);
          remainingFolders = remainingFolders.filter((other) => other.id !== folder.id);
          changed = true;
        }
      }
    }

    if (seedSnippetIds.size > 0) {
      await db.snippets.bulkDelete([...seedSnippetIds]);
    }
    if (seedFolderIds.size > 0) {
      await db.folders.bulkDelete([...seedFolderIds]);
    }

    anonymousFolders = anonymousFolders.filter((folder) => !seedFolderIds.has(folder.id));
    anonymousSnippets = anonymousSnippets.filter((snippet) => !seedSnippetIds.has(snippet.id));
  }

  if (anonymousFolders.length > 0) {
    await db.folders.bulkPut(
      anonymousFolders.map((folder) => ({ ...folder, ownerId: userId, dirty: true }))
    );
  }

  if (anonymousSnippets.length > 0) {
    await db.snippets.bulkPut(
      anonymousSnippets.map((snippet) => ({ ...snippet, ownerId: userId, dirty: true }))
    );
  }
}

/**
 * One-time takeover of records left behind by the previous backend.
 *
 * Records carry the `ownerId` of the account that created them, and every read
 * filters on it (`matchesOwner` in `src/lib/db.ts`). The accounts from the old
 * Supabase backend have different ids from the Convex ones, so after the
 * migration those records match neither the signed-in user nor the anonymous
 * case: they stay in IndexedDB, intact, but invisible — and `getDirtyWorkspace`
 * skips them too, so they never upload either. Re-owning them to the current
 * account restores both.
 *
 * `dirty` is set so the push that follows uploads them. `lastSyncedAt` is left
 * alone: clearing it would make an adopted-but-empty snippet look like a
 * brand-new placeholder to `syncDirtyWorkspace`, which settles those locally
 * instead of uploading — silently dropping a record the user still has.
 *
 * Guarded by a flag so it runs at most once per device. Without that guard a
 * second account signing in on the same machine would seize the first one's
 * records; after this has run once, every record already carries a Convex id
 * and normal per-account isolation applies.
 */
const LEGACY_ADOPTION_KEY = "klipcode.adoptedLegacyRecords";

async function adoptLegacyRecords(userId: string): Promise<void> {
  if (typeof localStorage === "undefined" || localStorage.getItem(LEGACY_ADOPTION_KEY)) {
    return;
  }

  // Set before doing the work: a crash midway must not leave the door open for
  // a later, different account to run the takeover instead.
  localStorage.setItem(LEGACY_ADOPTION_KEY, "1");

  const [folders, snippets] = await Promise.all([
    db.folders.toArray(),
    db.snippets.toArray(),
  ]);

  const isLegacy = (record: { ownerId: string | null }) =>
    record.ownerId !== null && record.ownerId !== userId;

  const legacyFolders = folders.filter(isLegacy);
  const legacySnippets = snippets.filter(isLegacy);

  if (legacyFolders.length > 0) {
    await db.folders.bulkPut(
      legacyFolders.map((folder) => ({ ...folder, ownerId: userId, dirty: true }))
    );
  }

  if (legacySnippets.length > 0) {
    await db.snippets.bulkPut(
      legacySnippets.map((snippet) => ({ ...snippet, ownerId: userId, dirty: true }))
    );
  }
}

export async function reconcileWorkspace(userId: string) {
  await adoptLegacyRecords(userId);
  await claimAnonymousRecords(userId);
  const result = await syncDirtyWorkspace(userId);
  await syncTombstones(userId);
  await fetchCloudWorkspace(userId);
  return result;
}
