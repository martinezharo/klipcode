import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import { readFileSync } from "node:fs";
import {
  pushWorkspace,
  removeWorkspace,
  workspaceChanges,
  hasWorkspaceContent,
} from "./workspace";
import {
  authConfig,
  hashSessionToken,
  readSessionUser,
  sameOrigin,
} from "./auth";
import type { CloudFolder, CloudSnippet } from "@/lib/types";

let mf: Miniflare;
let db: D1Database;
const at = "2026-09-01T00:00:00.000Z";
const folder = (
  clientId: string,
  parentId: string | null = null,
): CloudFolder => ({
  clientId,
  parentId,
  name: "ciphertext",
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
  cryptoVersion: 1,
  isPinnedAside: false,
  isPinnedHome: false,
});
const snippet = (
  clientId: string,
  folderId: string | null = null,
): CloudSnippet => ({
  clientId,
  folderId,
  title: "encrypted title",
  code: "encrypted code",
  language: "typescript",
  createdAt: at,
  updatedAt: at,
  deletedAt: null,
  cryptoVersion: 1,
  isPinnedAside: false,
  isPinnedHome: false,
});
beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: "2026-04-10",
    d1Databases: { DB: "test" },
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const sql =
    readFileSync(
      new URL("../../migrations/0001_d1_backend.sql", import.meta.url),
      "utf8",
    ) +
    readFileSync(
      new URL(
        "../../migrations/0002_signin_deduplication.sql",
        import.meta.url,
      ),
      "utf8",
    );
  for (const stmt of unstable_splitSqlQuery(sql)) await db.prepare(stmt).run();
  await db.batch(
    ["a", "b"].map((id) =>
      db
        .prepare("INSERT INTO users(id,email) VALUES(?,?)")
        .bind(id, `${id}@example.com`),
    ),
  );
});
afterEach(async () => {
  await mf.dispose();
});
describe("D1 workspace", () => {
  it("saves imported ISO offsets and compares equivalent timestamps by instant", async () => {
    const legacy = {
      ...snippet("legacy"),
      createdAt: "2026-07-16T11:04:39.716+00:00",
      updatedAt: "2026-09-01T02:00:00.19+02:00",
    };
    await pushWorkspace(db, "a", {
      folders: [{ ...folder("f"), createdAt: "2026-07-01T10:54:54.19+00:00" }],
      snippets: [legacy],
    });
    await pushWorkspace(db, "a", {
      folders: [],
      snippets: [{ ...legacy, code: "saved edit", updatedAt: "2026-09-01T00:00:01.000Z" }],
    });
    await pushWorkspace(db, "a", {
      folders: [],
      snippets: [legacy],
    });
    const records = await workspaceChanges(db, "a", null);
    expect(records.snippets[0].code).toBe("saved edit");
    expect(records.snippets[0].createdAt).toBe(legacy.createdAt);
    expect(records.folders[0].createdAt).toBe("2026-07-01T10:54:54.19+00:00");
  });
  it("isolates identical client ids by owner and keeps stale edits from overwriting newer ones", async () => {
    await pushWorkspace(db, "a", { folders: [], snippets: [snippet("same")] });
    await pushWorkspace(db, "b", {
      folders: [],
      snippets: [{ ...snippet("same"), code: "other account" }],
    });
    await pushWorkspace(db, "a", {
      folders: [],
      snippets: [
        {
          ...snippet("same"),
          code: "new",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
    });
    await pushWorkspace(db, "a", { folders: [], snippets: [snippet("same")] });
    expect((await workspaceChanges(db, "a", null)).snippets[0].code).toBe(
      "new",
    );
    expect((await workspaceChanges(db, "b", null)).snippets[0].code).toBe(
      "other account",
    );
    await removeWorkspace(db, "a", { folderIds: [], snippetIds: ["same"] });
    expect(await hasWorkspaceContent(db, "a")).toBe(false);
    expect(await hasWorkspaceContent(db, "b")).toBe(true);
  });
  it("rolls back all writes on a cycle and accepts parents that arrive later in a batch", async () => {
    await pushWorkspace(db, "a", {
      folders: [folder("child", "parent"), folder("parent")],
      snippets: [snippet("s", "child")],
    });
    expect(
      (await workspaceChanges(db, "a", null)).folders.find(
        (f) => f.clientId === "child",
      )?.parentId,
    ).toBe("parent");
    await expect(
      pushWorkspace(db, "a", {
        folders: [
          {
            ...folder("parent", "child"),
            updatedAt: "2026-09-02T00:00:00.000Z",
          },
        ],
        snippets: [snippet("never")],
      }),
    ).rejects.toThrow();
    expect((await workspaceChanges(db, "a", null)).snippets).toHaveLength(1);
    expect(
      (await workspaceChanges(db, "a", null)).folders.find(
        (f) => f.clientId === "parent",
      )?.parentId,
    ).toBeNull();
  });
  it("deletes descendants, detaches surviving snippets and reports deletions in deltas", async () => {
    await pushWorkspace(db, "a", {
      folders: [folder("root"), folder("child", "root")],
      snippets: [snippet("s", "child")],
    });
    const before = await workspaceChanges(db, "a", null);
    // Epoch equals the database clock; use the next cursor inside the retention window.
    await db
      .prepare("UPDATE app_meta SET value=0 WHERE key='backend_epoch'")
      .run();
    await removeWorkspace(db, "a", { folderIds: ["root"], snippetIds: [] });
    const after = await workspaceChanges(db, "a", before.cursor);
    expect(after.full).toBe(false);
    expect(after.deletedFolderIds.sort()).toEqual(["child", "root"]);
    expect(after.snippets[0].folderId).toBeNull();
    expect((await workspaceChanges(db, "a", 1)).full).toBe(true);
  });
  it("uses metadata triggers without copying ciphertext and avoids duplicate edit events", async () => {
    const s = { ...snippet("s"), updatedAt: "2026-09-02T00:00:00.000Z" };
    await pushWorkspace(db, "a", { folders: [], snippets: [s] });
    const rev = await db
      .prepare("SELECT revision FROM analytics_state WHERE id=1")
      .first<number>("revision");
    await pushWorkspace(db, "a", { folders: [], snippets: [s] });
    expect(
      await db
        .prepare("SELECT revision FROM analytics_state WHERE id=1")
        .first<number>("revision"),
    ).toBe(rev);
    const edits = await db.prepare("SELECT * FROM analytics_edits").all();
    expect(edits.results).toHaveLength(1);
    expect(JSON.stringify(edits.results)).not.toContain("encrypted");
  });
  it("rejects malformed and oversized data before writing", async () => {
    await expect(
      pushWorkspace(db, "a", {
        folders: [],
        snippets: [{ ...snippet("s"), updatedAt: "invalid" }],
      }),
    ).rejects.toThrow("timestamp");
    await expect(
      pushWorkspace(db, "a", {
        folders: [],
        snippets: [{ ...snippet("s"), code: "x".repeat(1900000) }],
      }),
    ).rejects.toThrow("storage limit");
    expect(await hasWorkspaceContent(db, "a")).toBe(false);
  });
});
describe("database authentication", () => {
  it("reuses the imported GitHub account id and stores only hashed session tokens", async () => {
    const env = {
      DB: db,
      AUTH_SECRET: "test secret",
      AUTH_GITHUB_ID: "id",
      AUTH_GITHUB_SECRET: "secret",
    } as CloudflareEnv;
    const adapter = authConfig(env, "https://klipcode.com").adapter!;
    await adapter.linkAccount!({
      provider: "github",
      providerAccountId: "123",
      type: "oauth",
      userId: "a",
    });
    expect(
      (
        await adapter.getUserByAccount!({
          provider: "github",
          providerAccountId: "123",
        })
      )?.id,
    ).toBe("a");
    const token = "unguessable-test-token";
    await adapter.createSession!({
      userId: "a",
      sessionToken: token,
      expires: new Date(Date.now() + 86400000),
    });
    expect(
      await db
        .prepare("SELECT sessionToken FROM sessions")
        .first<string>("sessionToken"),
    ).toBe(await hashSessionToken(token));
    const request = new Request("https://klipcode.com/api/workspace/changes", {
      headers: { cookie: `__Host-klipcode.session=${token}` },
    });
    expect((await readSessionUser(request, db))?.id).toBe("a");
    await adapter.deleteSession!(token);
    expect(await readSessionUser(request, db)).toBeNull();
  });
  it("refuses cross-origin writes and expired sessions", async () => {
    expect(
      sameOrigin(
        new Request("https://klipcode.com/api/workspace/push", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("https://klipcode.com/api/workspace/push", {
          method: "POST",
          headers: { origin: "https://klipcode.com" },
        }),
      ),
    ).toBe(true);
    const token = "expired";
    await db
      .prepare(
        "INSERT INTO sessions(id,userId,sessionToken,expires) VALUES(?,?,?,?)",
      )
      .bind("s", "a", await hashSessionToken(token), "2000-01-01T00:00:00.000Z")
      .run();
    expect(
      await readSessionUser(
        new Request("https://klipcode.com/api/auth/session", {
          headers: { cookie: `__Host-klipcode.session=${token}` },
        }),
        db,
      ),
    ).toBeNull();
  });
});
