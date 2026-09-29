/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SYNC_OVERLAP_MS } from "./lib/syncCursor";
import schema from "./schema";

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

describe("analytics", () => {
  const page = (table: "users" | "authSessions" | "snippets" | "folders" | "deletions", since: number | null) =>
    t.query(internal.analytics.page, { table, since, paginationOpts: { numItems: 100, cursor: null } });

  it("returns only the fields the console keeps", async () => {
    await as(alice).mutation(api.workspace.push, {
      folders: [folder("f1", { name: "secret folder" })],
      snippets: [snippet("s1", { title: "secret title", code: "secret code", folderId: "f1", isPinnedHome: true })],
    });

    const snippets = await page("snippets", null);
    expect(snippets.isDone).toBe(true);
    expect(snippets.rows).toHaveLength(1);
    expect(Object.keys(snippets.rows[0]).sort()).toEqual(
      ["createdAt", "deletedAt", "id", "inFolder", "language", "ownerId", "pinned", "updatedAt"].sort(),
    );
    expect(snippets.rows[0]).toMatchObject({ ownerId: alice, pinned: true, inFolder: true });
    expect(JSON.stringify(await page("folders", null))).not.toContain("secret");

    const users = await page("users", null);
    expect(users.rows.map((u) => ("id" in u ? u.id : null)).sort()).toEqual([alice, bob].sort());
    expect(Object.keys(users.rows[0]).sort()).toEqual(["createdAt", "id", "provider"]);
  });

  it("reads only what was written since the cursor, plus deletions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      let now = Date.UTC(2026, 8, 29, 12);
      vi.setSystemTime(now);
      await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("old"), snippet("gone")] });
      now += SYNC_OVERLAP_MS + 1;
      vi.setSystemTime(now);
      const cursor = (await page("snippets", null)).now;

      now += 1_000;
      vi.setSystemTime(now);
      await as(alice).mutation(api.workspace.push, { folders: [], snippets: [snippet("new")] });
      await as(alice).mutation(api.workspace.remove, { folderIds: [], snippetIds: ["gone"] });

      const snippets = await page("snippets", cursor);
      expect(snippets.rows).toHaveLength(1);
      const deletions = await page("deletions", cursor);
      expect(deletions.rows).toEqual([{ kind: "snippet", docId: expect.any(String) }]);
      expect((await page("deletions", null)).rows).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves excluded accounts by email without returning any email", async () => {
    const carol = await t.run((ctx) => ctx.db.insert("users", { email: "Carol@Example.com" }));

    expect(await t.query(internal.analytics.accountsByEmail, { emails: ["Carol@Example.com"] })).toEqual([carol]);
    expect(await t.query(internal.analytics.accountsByEmail, { emails: ["nobody@example.com", " "] })).toEqual([]);
  });
});
