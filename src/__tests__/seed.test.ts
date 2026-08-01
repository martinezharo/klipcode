// fake-indexeddb/auto is loaded via vitest setupFiles (vitest.config.ts).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Configurable Convex stand-in ───────────────────────────────────────────────
// `seedWelcomeContent` consults the cloud only when a deployment is configured.
// `workspace.hasContent` rejects an anonymous caller, so signed out the query
// throws — which is exactly the "no known cloud content" path. Tests flip these
// to exercise the local-only, signed-out and signed-in paths.
let mockSignedIn = false;
let mockCloud: { folders: number; snippets: number } = { folders: 0, snippets: 0 };
let mockClient: unknown = null;

function makeClient() {
  return {
    query: async () => {
      if (!mockSignedIn) throw new Error("Not authenticated");
      return mockCloud.folders > 0 || mockCloud.snippets > 0;
    },
  };
}

vi.mock("@/lib/convex", () => ({
  isConvexConfigured: () => mockClient !== null,
  getConvexBrowserClient: () => mockClient,
}));

import { db } from "@/lib/db";
import { readInitialWorkspace, seedWelcomeContent } from "@/lib/seed";
import type { Dictionary } from "@/i18n";

const copy = {
  seed: {
    folderName: "Welcome",
    snippetName: "Getting started",
    snippetContent: "# Hi",
  },
} as unknown as Dictionary;

// A minimal in-memory localStorage so the node test env can run the browser path.
function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

beforeEach(async () => {
  await db.folders.clear();
  await db.snippets.clear();
  mockSignedIn = false;
  mockCloud = { folders: 0, snippets: 0 };
  mockClient = null;
  installLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("seedWelcomeContent", () => {
  it("returns the seeded welcome records in the first paintable snapshot", async () => {
    const workspace = await readInitialWorkspace(copy, null);

    expect(workspace.folders).toHaveLength(1);
    expect(workspace.snippets).toHaveLength(1);
    expect(workspace.snippets[0]?.title).toBe("Getting started");
  });

  it("seeds a welcome folder and snippet on a truly empty first visit", async () => {
    const seeded = await seedWelcomeContent(copy);

    expect(seeded).toBe(true);
    expect(await db.folders.count()).toBe(1);
    expect(await db.snippets.count()).toBe(1);
  });

  it("only seeds once (the seeded flag short-circuits later calls)", async () => {
    await seedWelcomeContent(copy);
    const second = await seedWelcomeContent(copy);

    expect(second).toBe(false);
    expect(await db.snippets.count()).toBe(1);
  });

  it("does not seed when local content already exists", async () => {
    await db.snippets.put({
      id: "existing",
      ownerId: null,
      folderId: null,
      title: "Mine",
      code: "x",
      language: "javascript",
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      dirty: false,
      lastSyncedAt: null,
      deletedAt: null,
    });

    const seeded = await seedWelcomeContent(copy);

    expect(seeded).toBe(false);
    expect(await db.snippets.count()).toBe(1);
  });

  it("does not seed when the signed-in user already has cloud content", async () => {
    mockClient = makeClient();
    mockSignedIn = true;
    mockCloud = { folders: 0, snippets: 3 };

    const seeded = await seedWelcomeContent(copy);

    expect(seeded).toBe(false);
    expect(await db.snippets.count()).toBe(0);
  });

  it("still seeds when signed in but the cloud workspace is empty", async () => {
    mockClient = makeClient();
    mockSignedIn = true;
    mockCloud = { folders: 0, snippets: 0 };

    const seeded = await seedWelcomeContent(copy);

    expect(seeded).toBe(true);
    expect(await db.snippets.count()).toBe(1);
  });
});
