/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
