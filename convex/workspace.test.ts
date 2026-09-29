/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DELETION_RETENTION_MS, SYNC_OVERLAP_MS } from "./lib/syncCursor";
import schema from "./schema";

// These run the real backend functions against Convex's test harness, so they
// cover what Postgres used to enforce declaratively and now lives in TypeScript:
// per-user isolation (previously RLS policies), the folder-cycle check
// (previously the `validate_folder_hierarchy` trigger) and the delete cascade
// (previously the `(owner_id, parent_id)` foreign key).

const modules = import.meta.glob("./**/*.ts");

function folder(clientId: string, overrides: Record<string, unknown> = {}) {
  return {
    clientId,
    name: clientId,
    parentId: null,
    isPinnedAside: false,
    isPinnedHome: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    cryptoVersion: 0,
    ...overrides,
  };
}

function snippet(clientId: string, overrides: Record<string, unknown> = {}) {
  return {
    clientId,
    title: clientId,
    code: "console.log('hi')",
    language: "javascript",
    folderId: null,
    isPinnedAside: false,
    isPinnedHome: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    cryptoVersion: 0,
    ...overrides,
  };
}

let t: ReturnType<typeof convexTest>;
let alice: Id<"users">;
let bob: Id<"users">;

beforeEach(async () => {
  t = convexTest(schema, modules);
  alice = await t.run((ctx) => ctx.db.insert("users", {}));
  bob = await t.run((ctx) => ctx.db.insert("users", {}));
});

const as = (userId: Id<"users">) => t.withIdentity({ subject: userId });

describe("ownership", () => {
  it("rejects an unauthenticated caller", async () => {
    await expect(t.query(api.workspace.list, {})).rejects.toThrow("Not authenticated");
    await expect(t.mutation(api.workspace.push, { folders: [], snippets: [] })).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("never returns another account's records", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("alice-folder")],
      snippets: [snippet("alice-snippet")],
    });

    const bobsWorkspace = await as(bob).query(api.workspace.list, {});
    expect(bobsWorkspace.folders).toEqual([]);
    expect(bobsWorkspace.snippets).toEqual([]);
    expect(await as(bob).query(api.workspace.hasContent, {})).toBe(false);
    expect(await as(alice).query(api.workspace.hasContent, {})).toBe(true);
  });

  it("keeps a colliding clientId separate per account", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [folder("shared-id")], snippets: [] });
    await as(bob).mutation(api.workspace.push, {
      folders: [folder("shared-id", { name: "bob's" })],
      snippets: [],
    });

    const alices = await as(alice).query(api.workspace.list, {});
    expect(alices.folders).toHaveLength(1);
    expect(alices.folders[0].name).toBe("shared-id");
  });

  it("cannot delete another account's records", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("s1")] });

    await as(bob).mutation(api.workspace.remove, { folderIds: [], snippetIds: ["s1"] });

    const alices = await as(alice).query(api.workspace.list, {});
    expect(alices.snippets).toHaveLength(1);
  });
});

describe("push", () => {
  it("accepts a child folder in the same batch as its parent", async () => {
    // The Postgres foreign key forced one request per depth level; here the
    // whole tree lands in a single transaction.
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("child", { parentId: "parent" }), folder("parent")],
      snippets: [snippet("s1", { folderId: "child" })],
    });

    const { folders, snippets } = await as(alice).query(api.workspace.list, {});
    expect(folders.find((f) => f.clientId === "child")?.parentId).toBe("parent");
    expect(snippets[0].folderId).toBe("child");
  });

  it("ignores an update older than the stored one", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("s1", { title: "newer", updatedAt: "2024-06-01T00:00:00.000Z" })],
    });
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("s1", { title: "older", updatedAt: "2024-01-01T00:00:00.000Z" })],
    });

    const { snippets } = await as(alice).query(api.workspace.list, {});
    expect(snippets[0].title).toBe("newer");
  });

  it("does not let a stale folder move poison cycle validation", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("a"), folder("b", { parentId: "a" })],
      snippets: [],
    });

    await as(alice).mutation(api.workspace.push, {
      folders: [
        // This move is older than the stored root relationship and must be
        // ignored when the complete post-write graph is assembled.
        folder("a", { parentId: "b", updatedAt: "2023-01-01T00:00:00.000Z" }),
        folder("c", { parentId: "b", updatedAt: "2024-06-01T00:00:00.000Z" }),
      ],
      snippets: [],
    });

    const { folders } = await as(alice).query(api.workspace.list, {});
    expect(folders.find((item) => item.clientId === "a")?.parentId).toBeNull();
    expect(folders.find((item) => item.clientId === "c")?.parentId).toBe("b");
  });

  it("rejects duplicate logical records in one batch", async () => {
    await expect(
      as(alice).mutation(api.workspace.push, {
        folders: [folder("duplicate"), folder("duplicate", { name: "second" })],
        snippets: [],
      }),
    ).rejects.toThrow("Duplicate folder clientId");

    await expect(
      as(alice).query(api.workspace.list, {}),
    ).resolves.toEqual({ folders: [], snippets: [] });
  });

  it("rejects a batch that would make a folder its own ancestor", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("a"), folder("b", { parentId: "a" })],
      snippets: [],
    });

    await expect(
      as(alice).mutation(api.workspace.push, {
        folders: [folder("a", { parentId: "b", updatedAt: "2024-06-01T00:00:00.000Z" })],
        snippets: [],
      })
    ).rejects.toThrow("cycles");
  });

  it("reparents to the root when the parent no longer exists", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("orphan", { parentId: "deleted-elsewhere" })],
      snippets: [snippet("s1", { folderId: "deleted-elsewhere" })],
    });

    const { folders, snippets } = await as(alice).query(api.workspace.list, {});
    expect(folders[0].parentId).toBeNull();
    expect(snippets[0].folderId).toBeNull();
  });
});

describe("remove", () => {
  it("cascades to descendant folders and detaches their snippets", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("root"), folder("child", { parentId: "root" })],
      snippets: [snippet("inside", { folderId: "child" }), snippet("outside")],
    });

    await as(alice).mutation(api.workspace.remove, { folderIds: ["root"], snippetIds: [] });

    const { folders, snippets } = await as(alice).query(api.workspace.list, {});
    expect(folders).toEqual([]);
    // The snippet survives the folder that held it, detached to the root —
    // matching the old `on delete set null`.
    expect(snippets.map((s) => s.clientId).sort()).toEqual(["inside", "outside"]);
    expect(snippets.find((s) => s.clientId === "inside")?.folderId).toBeNull();
  });

  it("is idempotent for ids that are already gone", async () => {
    await expect(
      as(alice).mutation(api.workspace.remove, { folderIds: ["nope"], snippetIds: ["nope"] })
    ).resolves.not.toThrow();
  });
});

describe("push without folders", () => {
  it("keeps a snippet in a folder that exists and detaches it from one that does not", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [folder("kept")], snippets: [] });

    // Snippet-only batches look folders up one by one instead of loading the tree.
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("in-kept", { folderId: "kept" }), snippet("in-gone", { folderId: "gone" })],
    });

    const { snippets } = await as(alice).query(api.workspace.list, {});
    expect(snippets.find((s) => s.clientId === "in-kept")?.folderId).toBe("kept");
    expect(snippets.find((s) => s.clientId === "in-gone")?.folderId).toBeNull();
  });

  it("does not see another account's folder with the same client id", async () => {
    await as(bob).mutation(api.workspace.push, { folders: [folder("bobs")], snippets: [] });
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("s1", { folderId: "bobs" })] });

    const { snippets } = await as(alice).query(api.workspace.list, {});
    expect(snippets[0].folderId).toBeNull();
  });
});

// ── Incremental sync ────────────────────────────────────────────────────────

describe("changes", () => {
  let now = Date.UTC(2026, 8, 29, 12);
  const advance = (ms: number) => {
    now += ms;
    vi.setSystemTime(now);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    now = Date.UTC(2026, 8, 29, 12);
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ids = (records: Array<{ clientId: string }>) => records.map((r) => r.clientId).sort();

  it("rejects an unauthenticated caller", async () => {
    await expect(t.query(api.workspace.changes, { since: null })).rejects.toThrow("Not authenticated");
  });

  it("sends the whole workspace, without server bookkeeping, when there is no cursor", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [folder("f1")], snippets: [snippet("s1")] });

    const result = await as(alice).query(api.workspace.changes, { since: null });
    expect(result.full).toBe(true);
    expect(result.cursor).toBe(now);
    expect(result).toMatchObject({ folders: await as(alice).query(api.workspace.list, {}).then((w) => w.folders) });
    expect(ids(result.snippets)).toEqual(["s1"]);
    expect(result.snippets[0]).not.toHaveProperty("serverUpdatedAt");
    expect(result.snippets[0]).not.toHaveProperty("ownerId");
  });

  it("afterwards sends only what was written since the cursor", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [folder("f1")], snippets: [snippet("old")] });
    advance(SYNC_OVERLAP_MS + 1);
    const first = await as(alice).query(api.workspace.changes, { since: null });

    advance(SYNC_OVERLAP_MS + 1);
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("new"), snippet("old", { title: "edited", updatedAt: "2024-02-01T00:00:00.000Z" })],
    });
    advance(SYNC_OVERLAP_MS + 1);
    const second = await as(alice).query(api.workspace.changes, { since: first.cursor });

    expect(second.full).toBe(false);
    expect(ids(second.folders)).toEqual([]);
    expect(ids(second.snippets)).toEqual(["new", "old"]);
    expect(second.snippets.find((s) => s.clientId === "old")?.title).toBe("edited");

    advance(SYNC_OVERLAP_MS + 1);
    const third = await as(alice).query(api.workspace.changes, { since: second.cursor });
    expect(ids(third.snippets)).toEqual([]);
  });

  it("re-sends writes from just before the cursor, which may have committed after it", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("s1")] });
    advance(1_000);
    const result = await as(alice).query(api.workspace.changes, { since: now });
    expect(ids(result.snippets)).toEqual(["s1"]);
  });

  it("does not advance a record whose stale update was ignored", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("s1", { updatedAt: "2024-06-01T00:00:00.000Z" })],
    });
    advance(SYNC_OVERLAP_MS + 1);
    const cursor = now;
    await as(alice).mutation(api.workspace.push, {
      folders: [],
      snippets: [snippet("s1", { updatedAt: "2024-01-01T00:00:00.000Z" })],
    });
    advance(SYNC_OVERLAP_MS + 1);

    const result = await as(alice).query(api.workspace.changes, { since: cursor });
    expect(ids(result.snippets)).toEqual([]);
  });

  it("reports permanent deletions, including a folder cascade and the snippets it detached", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("root"), folder("child", { parentId: "root" })],
      snippets: [snippet("inside", { folderId: "child" }), snippet("doomed"), snippet("untouched")],
    });
    advance(SYNC_OVERLAP_MS + 1);
    const cursor = now;

    await as(alice).mutation(api.workspace.remove, { folderIds: ["root"], snippetIds: ["doomed"] });
    advance(SYNC_OVERLAP_MS + 1);

    const result = await as(alice).query(api.workspace.changes, { since: cursor });
    expect(result.full).toBe(false);
    expect([...result.deletedFolderIds].sort()).toEqual(["child", "root"]);
    expect(result.deletedSnippetIds).toEqual(["doomed"]);
    expect(ids(result.snippets)).toEqual(["inside"]);
    expect(result.snippets[0].folderId).toBeNull();
  });

  it("never reports another account's changes or deletions", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("s1")] });
    const cursor = now;
    advance(1);
    await as(bob).mutation(api.workspace.push, { folders: [], snippets: [snippet("b1")] });
    await as(bob).mutation(api.workspace.remove, { folderIds: [], snippetIds: ["b1"] });

    const result = await as(alice).query(api.workspace.changes, { since: cursor });
    expect(ids(result.snippets)).toEqual(["s1"]);
    expect(result.deletedSnippetIds).toEqual([]);
  });

  it("falls back to a full read once the cursor is older than the deletion log", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("s1")] });
    const cursor = now;
    advance(DELETION_RETENTION_MS + 1);

    const result = await as(alice).query(api.workspace.changes, { since: cursor });
    expect(result.full).toBe(true);
    expect(ids(result.snippets)).toEqual(["s1"]);
  });

  it("prunes deletion entries past the retention window", async () => {
    await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("a"), snippet("b")] });
    await as(alice).mutation(api.workspace.remove, { folderIds: [], snippetIds: ["a"] });
    advance(DELETION_RETENTION_MS + 1);
    await as(alice).mutation(api.workspace.remove, { folderIds: [], snippetIds: ["b"] });

    const log = await t.run((ctx) => ctx.db.query("deletions").collect());
    expect(log.map((entry) => entry.clientId)).toEqual(["b"]);
  });
});
