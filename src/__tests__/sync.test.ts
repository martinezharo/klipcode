// fake-indexeddb/auto is loaded via vitest setupFiles (vitest.config.ts).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { assertNoFolderCycles, collectDescendantFolderIds } from "@convex/lib/hierarchy";
import type { CloudFolder, CloudSnippet, FolderRecord, SnippetRecord } from "@/lib/types";

// ── Mocked Convex deployment ───────────────────────────────────────────────────
// A tiny in-memory stand-in for the deployment: it dispatches on the function
// name, so the sync engine talks to it exactly as it talks to the real client.
// The integrity rules (last-write-wins, reparenting, delete cascade) are the
// real ones — `convex/lib/hierarchy.ts` is imported rather than reimplemented —
// so a batch the production backend would reject is rejected here too.

const USER = "user-1";

type StoredFolder = CloudFolder & { ownerId: string };
type StoredSnippet = CloudSnippet & { ownerId: string };

const cloud: { folders: StoredFolder[]; snippets: StoredSnippet[] } = { folders: [], snippets: [] };

/** Whom the fake deployment treats the caller as. Convex derives this from the
 *  session; here it is explicit so tests can assert what a record was stored under. */
let currentUserId = USER;

function stripOwner<T extends { ownerId: string }>(record: T) {
  const { ownerId, ...rest } = record;
  void ownerId;
  return rest;
}

function ownedFolders() {
  return cloud.folders.filter((folder) => folder.ownerId === currentUserId);
}

function ownedSnippets() {
  return cloud.snippets.filter((snippet) => snippet.ownerId === currentUserId);
}

function push({ folders, snippets }: { folders: CloudFolder[]; snippets: CloudSnippet[] }) {
  const links = new Map<string, string | null>(
    ownedFolders().map((folder) => [folder.clientId, folder.parentId])
  );
  for (const folder of folders) links.set(folder.clientId, folder.parentId);

  const touched: string[] = [];

  for (const incoming of folders) {
    const index = cloud.folders.findIndex(
      (stored) => stored.ownerId === currentUserId && stored.clientId === incoming.clientId
    );
    if (index >= 0 && cloud.folders[index].updatedAt > incoming.updatedAt) continue;

    const parentId = incoming.parentId !== null && links.has(incoming.parentId) ? incoming.parentId : null;
    links.set(incoming.clientId, parentId);
    touched.push(incoming.clientId);

    const stored: StoredFolder = { ...incoming, parentId, ownerId: currentUserId };
    if (index >= 0) cloud.folders[index] = stored;
    else cloud.folders.push(stored);
  }

  assertNoFolderCycles(
    [...links].map(([clientId, parentId]) => ({ clientId, parentId })),
    touched
  );

  for (const incoming of snippets) {
    const index = cloud.snippets.findIndex(
      (stored) => stored.ownerId === currentUserId && stored.clientId === incoming.clientId
    );
    if (index >= 0 && cloud.snippets[index].updatedAt > incoming.updatedAt) continue;

    const folderId = incoming.folderId !== null && links.has(incoming.folderId) ? incoming.folderId : null;
    const stored: StoredSnippet = { ...incoming, folderId, ownerId: currentUserId };
    if (index >= 0) cloud.snippets[index] = stored;
    else cloud.snippets.push(stored);
  }
}

function remove({ folderIds, snippetIds }: { folderIds: string[]; snippetIds: string[] }) {
  const doomedFolders = collectDescendantFolderIds(ownedFolders(), folderIds);
  const doomedSnippets = new Set(snippetIds);

  cloud.snippets = cloud.snippets.filter(
    (snippet) => !(snippet.ownerId === currentUserId && doomedSnippets.has(snippet.clientId))
  );
  for (const snippet of cloud.snippets) {
    if (snippet.folderId !== null && doomedFolders.has(snippet.folderId)) snippet.folderId = null;
  }
  cloud.folders = cloud.folders.filter(
    (folder) => !(folder.ownerId === currentUserId && doomedFolders.has(folder.clientId))
  );
}

const convexClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(reference: FunctionReference<"query">): Promise<any> {
    switch (getFunctionName(reference)) {
      case "workspace:list":
        return { folders: ownedFolders().map(stripOwner), snippets: ownedSnippets().map(stripOwner) };
      case "workspace:hasContent":
        return ownedFolders().length > 0 || ownedSnippets().length > 0;
      default:
        throw new Error(`Unexpected query ${getFunctionName(reference)}`);
    }
  },
  async mutation(reference: FunctionReference<"mutation">, args: never) {
    switch (getFunctionName(reference)) {
      case "workspace:push":
        return push(args);
      case "workspace:remove":
        return remove(args);
      default:
        throw new Error(`Unexpected mutation ${getFunctionName(reference)}`);
    }
  },
};

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: () => true,
  getConvexBrowserClient: () => convexClient,
}));

// ── Mocked encryption key ──────────────────────────────────────────────────────
// `null` (the default) runs sync in plaintext mode, matching the pre-encryption
// behavior every other test relies on; individual tests set a real key to
// exercise the encrypted path.
const cryptoTestState = vi.hoisted(() => ({ key: null as CryptoKey | null }));

vi.mock("@/lib/encryptionKey", () => ({
  getWorkspaceEncryptionKey: async () => cryptoTestState.key,
  clearWorkspaceEncryptionKey: () => {
    cryptoTestState.key = null;
  },
}));

import {
  CURRENT_CRYPTO_VERSION,
  decryptString,
  encryptString,
  generateDekBytes,
  importAesKey,
} from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  fetchCloudWorkspace,
  recordDeletions,
  reconcileWorkspace,
  syncDirtyWorkspace,
  syncTombstones,
} from "@/lib/sync";

let counter = 0;
function uid() {
  return `id-${++counter}`;
}

function makeSnippet(overrides: Partial<SnippetRecord> = {}): SnippetRecord {
  return {
    id: uid(),
    ownerId: USER,
    folderId: null,
    title: "Snippet",
    code: 'console.log("hi")',
    language: "javascript",
    isPinnedAside: false,
    isPinnedHome: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    dirty: false,
    lastSyncedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<FolderRecord> = {}): FolderRecord {
  return {
    id: uid(),
    ownerId: USER,
    name: "Folder",
    parentId: null,
    isPinnedAside: false,
    isPinnedHome: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    dirty: false,
    lastSyncedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function cloudFolder(folder: FolderRecord): StoredFolder {
  return {
    clientId: folder.id,
    ownerId: USER,
    name: folder.name,
    parentId: folder.parentId,
    isPinnedAside: folder.isPinnedAside,
    isPinnedHome: folder.isPinnedHome,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    deletedAt: folder.deletedAt,
    cryptoVersion: 0,
  };
}

function cloudSnippet(snippet: SnippetRecord): StoredSnippet {
  return {
    clientId: snippet.id,
    ownerId: USER,
    folderId: snippet.folderId,
    title: snippet.title,
    code: snippet.code,
    language: snippet.language,
    isPinnedAside: snippet.isPinnedAside,
    isPinnedHome: snippet.isPinnedHome,
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
    deletedAt: snippet.deletedAt,
    cryptoVersion: 0,
  };
}

beforeEach(async () => {
  await db.folders.clear();
  await db.snippets.clear();
  await db.tombstones.clear();
  cloud.folders = [];
  cloud.snippets = [];
  currentUserId = USER;
  cryptoTestState.key = null;
});

// ── Delete propagation (reconciliation) ─────────────────────────────────────────

describe("fetchCloudWorkspace() deletion reconciliation", () => {
  it("removes previously-synced local records that are absent from the cloud", async () => {
    const present = makeFolder();
    const deletedRemotely = makeFolder();
    await db.folders.bulkAdd([present, deletedRemotely]);

    const deletedSnippet = makeSnippet();
    await db.snippets.add(deletedSnippet);

    // Cloud still has `present`, but the other two were deleted on another device.
    cloud.folders = [cloudFolder(present)];
    cloud.snippets = [];

    await fetchCloudWorkspace(USER);

    expect(await db.folders.get(present.id)).toBeDefined();
    expect(await db.folders.get(deletedRemotely.id)).toBeUndefined();
    expect(await db.snippets.get(deletedSnippet.id)).toBeUndefined();
  });

  it("keeps dirty, never-synced, and shared records during reconciliation", async () => {
    const dirty = makeSnippet({ dirty: true });
    const neverSynced = makeSnippet({ dirty: false, lastSyncedAt: null });
    const seed = makeSnippet({ ownerId: null });
    await db.snippets.bulkAdd([dirty, neverSynced, seed]);

    cloud.folders = [];
    cloud.snippets = [];

    await fetchCloudWorkspace(USER);

    expect(await db.snippets.get(dirty.id)).toBeDefined();
    expect(await db.snippets.get(neverSynced.id)).toBeDefined();
    expect(await db.snippets.get(seed.id)).toBeDefined();
  });

  it("propagates a permanent delete (cloud row absent) even for a trashed record", async () => {
    // Soft delete keeps the cloud row; an absent row means a permanent delete on
    // another device, which must be applied locally even if it's still trashed.
    const trashedFolder = makeFolder({ deletedAt: "2024-02-01T00:00:00.000Z" });
    const trashedSnippet = makeSnippet({ deletedAt: "2024-02-01T00:00:00.000Z" });
    await db.folders.add(trashedFolder);
    await db.snippets.add(trashedSnippet);

    cloud.folders = [];
    cloud.snippets = [];

    await fetchCloudWorkspace(USER);

    expect(await db.folders.get(trashedFolder.id)).toBeUndefined();
    expect(await db.snippets.get(trashedSnippet.id)).toBeUndefined();
  });

  it("syncs the trash state down: a cloud deletedAt marks the local record trashed", async () => {
    const live = makeSnippet({ deletedAt: null });
    await db.snippets.add(live);
    // Same row, now soft-deleted on another device (deletedAt set, newer).
    cloud.snippets = [cloudSnippet({ ...live, deletedAt: "2024-03-01T00:00:00.000Z", updatedAt: "2024-03-01T00:00:00.000Z" })];

    await fetchCloudWorkspace(USER);

    expect((await db.snippets.get(live.id))?.deletedAt).toBe("2024-03-01T00:00:00.000Z");
  });
});

// ── Clearing a snippet's code ───────────────────────────────────────────────────

describe("syncDirtyWorkspace() empty-code handling", () => {
  it("uploads an intentionally cleared body for a previously-synced snippet", async () => {
    const cleared = makeSnippet({ code: "", dirty: true, lastSyncedAt: "2024-01-01T00:00:00.000Z" });
    await db.snippets.add(cleared);

    const result = await syncDirtyWorkspace(USER);

    const uploaded = cloud.snippets.find((row) => row.clientId === cleared.id);
    expect(uploaded).toBeDefined();
    expect(uploaded?.code).toBe("");
    expect(result.syncedSnippetIds).toContain(cleared.id);
    expect((await db.snippets.get(cleared.id))?.dirty).toBe(false);
  });

  it("settles a brand-new empty placeholder locally without uploading it", async () => {
    const placeholder = makeSnippet({ code: "", dirty: true, lastSyncedAt: null });
    await db.snippets.add(placeholder);

    const result = await syncDirtyWorkspace(USER);

    expect(cloud.snippets.find((row) => row.clientId === placeholder.id)).toBeUndefined();
    expect(result.localSnippetIds).toContain(placeholder.id);

    const stored = await db.snippets.get(placeholder.id);
    expect(stored?.dirty).toBe(false);
    expect(stored?.lastSyncedAt).toBeNull();
  });
});

// ── Batched uploads ─────────────────────────────────────────────────────────────

describe("syncDirtyWorkspace() batching", () => {
  it("uploads every dirty snippet in one pass and clears their dirty flag", async () => {
    const a = makeSnippet({ dirty: true });
    const b = makeSnippet({ dirty: true });
    const c = makeSnippet({ dirty: true });
    await db.snippets.bulkAdd([a, b, c]);

    const result = await syncDirtyWorkspace(USER);

    expect(result.syncedSnippetIds).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    for (const id of [a.id, b.id, c.id]) {
      expect(cloud.snippets.find((row) => row.clientId === id)).toBeDefined();
      expect((await db.snippets.get(id))?.dirty).toBe(false);
    }
  });

  it("uploads nested folders parent-before-child across depth levels", async () => {
    const root = makeFolder({ dirty: true, parentId: null });
    const child = makeFolder({ dirty: true, parentId: root.id });
    const grandchild = makeFolder({ dirty: true, parentId: child.id });
    // Insert out of order to prove ordering comes from depth, not insertion.
    await db.folders.bulkAdd([grandchild, root, child]);

    const result = await syncDirtyWorkspace(USER);

    expect(result.syncedFolderIds).toEqual(expect.arrayContaining([root.id, child.id, grandchild.id]));
    const order = cloud.folders.map((row) => row.clientId);
    expect(order.indexOf(root.id)).toBeLessThan(order.indexOf(child.id));
    expect(order.indexOf(child.id)).toBeLessThan(order.indexOf(grandchild.id));
  });
});

// ── Tombstones (deletion queue) ─────────────────────────────────────────────────

describe("syncTombstones() + fetchCloudWorkspace()", () => {
  it("deletes the cloud row and clears the tombstone on success", async () => {
    const snippet = makeSnippet();
    cloud.snippets = [cloudSnippet(snippet)];
    await recordDeletions(USER, [{ id: snippet.id, kind: "snippet" }]);

    await syncTombstones(USER);

    expect(cloud.snippets.find((row) => row.clientId === snippet.id)).toBeUndefined();
    expect(await db.tombstones.get(snippet.id)).toBeUndefined();
  });

  it("does not resurrect a tombstoned row while its delete is still pending", async () => {
    // The cloud delete failed earlier, so the row is still in the cloud and a
    // tombstone is queued. A pull must not re-download it.
    const snippet = makeSnippet();
    cloud.snippets = [cloudSnippet(snippet)];
    await recordDeletions(USER, [{ id: snippet.id, kind: "snippet" }]);

    await fetchCloudWorkspace(USER);

    expect(await db.snippets.get(snippet.id)).toBeUndefined();
    expect(await db.tombstones.get(snippet.id)).toBeDefined();
  });
});

// ── Claiming anonymous/seed content on sign-in ──────────────────────────────────

describe("reconcileWorkspace() anonymous claim", () => {
  it("uploads seed (ownerId null, clean) records and assigns them to the account", async () => {
    const seedFolder = makeFolder({ ownerId: null, dirty: false, lastSyncedAt: null });
    const seedSnippet = makeSnippet({
      ownerId: null,
      dirty: false,
      lastSyncedAt: null,
      folderId: seedFolder.id,
    });
    await db.folders.add(seedFolder);
    await db.snippets.add(seedSnippet);

    await reconcileWorkspace(USER);

    expect(cloud.folders.find((row) => row.clientId === seedFolder.id)?.ownerId).toBe(USER);
    expect(cloud.snippets.find((row) => row.clientId === seedSnippet.id)?.ownerId).toBe(USER);

    const localSnippet = await db.snippets.get(seedSnippet.id);
    expect(localSnippet?.ownerId).toBe(USER);
    expect(localSnippet?.dirty).toBe(false);
    expect(localSnippet?.lastSyncedAt).not.toBeNull();
  });

  it("discards an untouched seed instead of claiming it when the account already has cloud content", async () => {
    // The account was used before: a returning sign-in, not a new user.
    const existing = makeSnippet();
    cloud.snippets = [cloudSnippet(existing)];

    const seedFolder = makeFolder({ ownerId: null, dirty: false, lastSyncedAt: null });
    const seedSnippet = makeSnippet({
      ownerId: null,
      dirty: false,
      lastSyncedAt: null,
      folderId: seedFolder.id,
    });
    await db.folders.add(seedFolder);
    await db.snippets.add(seedSnippet);

    await reconcileWorkspace(USER);

    // The seed never reaches the cloud and is gone locally too.
    expect(cloud.folders.find((row) => row.clientId === seedFolder.id)).toBeUndefined();
    expect(cloud.snippets.find((row) => row.clientId === seedSnippet.id)).toBeUndefined();
    expect(await db.folders.get(seedFolder.id)).toBeUndefined();
    expect(await db.snippets.get(seedSnippet.id)).toBeUndefined();

    // The existing cloud content is pulled down as usual.
    expect(await db.snippets.get(existing.id)).toBeDefined();
  });

  it("keeps the seed folder when it holds real anonymous work, discarding only pristine records", async () => {
    const existing = makeSnippet();
    cloud.snippets = [cloudSnippet(existing)];

    const seedFolder = makeFolder({ ownerId: null, dirty: false, lastSyncedAt: null });
    const seedSnippet = makeSnippet({
      ownerId: null,
      dirty: false,
      lastSyncedAt: null,
      folderId: seedFolder.id,
    });
    // The user edited/created this one while anonymous, so it is dirty.
    const editedSnippet = makeSnippet({
      ownerId: null,
      dirty: true,
      lastSyncedAt: null,
      folderId: seedFolder.id,
    });
    await db.folders.add(seedFolder);
    await db.snippets.bulkAdd([seedSnippet, editedSnippet]);

    await reconcileWorkspace(USER);

    // The pristine seed snippet is dropped, but the folder survives (it still
    // holds real work) and is claimed together with the edited snippet.
    expect(await db.snippets.get(seedSnippet.id)).toBeUndefined();
    expect(cloud.snippets.find((row) => row.clientId === seedSnippet.id)).toBeUndefined();

    expect(cloud.folders.find((row) => row.clientId === seedFolder.id)?.ownerId).toBe(USER);
    expect(cloud.snippets.find((row) => row.clientId === editedSnippet.id)?.ownerId).toBe(USER);
    expect((await db.snippets.get(editedSnippet.id))?.ownerId).toBe(USER);
  });
});

// ── Cloud encryption boundary ───────────────────────────────────────────────────

describe("cloud encryption", () => {
  async function withKey(): Promise<CryptoKey> {
    const key = await importAesKey(generateDekBytes());
    cryptoTestState.key = key;
    return key;
  }

  it("uploads ciphertext with the current cryptoVersion while local data stays plaintext", async () => {
    const key = await withKey();
    const folder = makeFolder({ dirty: true, name: "Secret folder" });
    const snippet = makeSnippet({ dirty: true, title: "API keys", code: "const token = 'hush';" });
    await db.folders.add(folder);
    await db.snippets.add(snippet);

    await syncDirtyWorkspace(USER);

    const folderRow = cloud.folders.find((row) => row.clientId === folder.id)!;
    const snippetRow = cloud.snippets.find((row) => row.clientId === snippet.id)!;

    expect(folderRow.cryptoVersion).toBe(CURRENT_CRYPTO_VERSION);
    expect(snippetRow.cryptoVersion).toBe(CURRENT_CRYPTO_VERSION);
    // Nothing sensitive crosses in plaintext…
    expect(folderRow.name).not.toBe(folder.name);
    expect(snippetRow.title).not.toBe(snippet.title);
    expect(snippetRow.code).not.toContain("hush");
    // …but it round-trips with the key. `language` intentionally stays clear.
    expect(await decryptString(key, folderRow.name)).toBe(folder.name);
    expect(await decryptString(key, snippetRow.title)).toBe(snippet.title);
    expect(await decryptString(key, snippetRow.code)).toBe(snippet.code);
    expect(snippetRow.language).toBe(snippet.language);

    // The local source of truth is untouched by the boundary encryption.
    expect((await db.snippets.get(snippet.id))?.code).toBe(snippet.code);
    expect((await db.folders.get(folder.id))?.name).toBe(folder.name);
  });

  it("uploads plaintext with cryptoVersion 0 when no key is available", async () => {
    const snippet = makeSnippet({ dirty: true });
    await db.snippets.add(snippet);

    await syncDirtyWorkspace(USER);

    const row = cloud.snippets.find((r) => r.clientId === snippet.id)!;
    expect(row.cryptoVersion).toBe(0);
    expect(row.code).toBe(snippet.code);
  });

  it("decrypts encrypted rows and passes plaintext rows through on fetch (mixed workspace)", async () => {
    const key = await withKey();

    const legacy = makeSnippet({ title: "Legacy", code: "plain()" });
    const secret = makeSnippet({ title: "Secret", code: "cipher()" });
    const secretFolder = makeFolder({ name: "Vault" });

    cloud.snippets = [
      cloudSnippet(legacy),
      {
        ...cloudSnippet(secret),
        title: await encryptString(key, secret.title),
        code: await encryptString(key, secret.code),
        cryptoVersion: CURRENT_CRYPTO_VERSION,
      },
    ];
    cloud.folders = [
      {
        ...cloudFolder(secretFolder),
        name: await encryptString(key, secretFolder.name),
        cryptoVersion: CURRENT_CRYPTO_VERSION,
      },
    ];

    await fetchCloudWorkspace(USER);

    expect((await db.snippets.get(legacy.id))?.code).toBe("plain()");
    expect((await db.snippets.get(secret.id))?.title).toBe("Secret");
    expect((await db.snippets.get(secret.id))?.code).toBe("cipher()");
    expect((await db.folders.get(secretFolder.id))?.name).toBe("Vault");
  });

  it("skips rows with an unknown future cryptoVersion without touching the local copy", async () => {
    await withKey();

    const local = makeSnippet({ title: "Kept", dirty: false });
    await db.snippets.add(local);

    // The same record was uploaded by a newer client with a scheme this build
    // doesn't understand: it must be neither garbled locally nor deleted.
    cloud.snippets = [{ ...cloudSnippet(local), title: "??", code: "??", cryptoVersion: 99 }];

    await fetchCloudWorkspace(USER);

    const stored = await db.snippets.get(local.id);
    expect(stored?.title).toBe("Kept");
  });

  it("skips rows that fail to decrypt instead of storing garbage or deleting local data", async () => {
    await withKey();
    const otherKey = await importAesKey(generateDekBytes());

    const local = makeSnippet({ title: "Intact", dirty: false });
    await db.snippets.add(local);

    cloud.snippets = [
      {
        ...cloudSnippet(local),
        title: await encryptString(otherKey, "tampered"),
        code: await encryptString(otherKey, "tampered"),
        cryptoVersion: CURRENT_CRYPTO_VERSION,
      },
    ];

    await fetchCloudWorkspace(USER);

    const stored = await db.snippets.get(local.id);
    expect(stored).toBeDefined();
    expect(stored?.title).toBe("Intact");
  });
});
