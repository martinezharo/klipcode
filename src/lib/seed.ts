import { db, readWorkspace } from "@/lib/db";
import { newId } from "@/lib/crypto";
import { api } from "@convex/_generated/api";
import { getConvexBrowserClient } from "@/lib/convex";
import type { WorkspaceSnapshot } from "@/lib/types";
import type { Dictionary } from "@/i18n";

const SEEDED_KEY = "klipcode.seeded";

/**
 * Whether the user already has a workspace — locally (IndexedDB) or in the cloud
 * (Convex, when signed in). Used to avoid seeding welcome content on top of
 * real data: e.g. a fresh device that's about to claim an account which already
 * has snippets, or a returning user whose `klipcode.seeded` flag was cleared.
 */
async function hasExistingContent(): Promise<boolean> {
  const [localFolders, localSnippets] = await Promise.all([
    db.folders.count(),
    db.snippets.count(),
  ]);

  if (localFolders > 0 || localSnippets > 0) {
    return true;
  }

  const convex = getConvexBrowserClient();

  if (!convex) {
    return false;
  }

  // Only the signed-in user's own records count; an anonymous visitor has no
  // cloud workspace to protect, and `hasContent` rejects an unauthenticated
  // caller. A network failure shouldn't block first-visit seeding either, so any
  // thrown error is treated as "no known cloud content".
  try {
    return await convex.query(api.workspace.hasContent, {});
  } catch {
    return false;
  }
}

/**
 * Seeds the local IndexedDB with a welcome folder and snippet on first visit.
 * Returns true if seeding actually happened, false if already seeded or skipped
 * because a workspace already exists.
 */
export async function seedWelcomeContent(copy: Dictionary): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(SEEDED_KEY)) return false;

  // Set flag first to prevent duplicate concurrent calls.
  localStorage.setItem(SEEDED_KEY, "1");

  // Never seed welcome files when the user already has content saved (locally or
  // in the cloud) — they'd otherwise pollute a real workspace and, once claimed
  // by an account, sync up to every device.
  if (await hasExistingContent()) {
    return false;
  }

  const now = new Date().toISOString();
  const folderId = newId();
  const snippetId = newId();

  await db.transaction("rw", [db.folders, db.snippets], async () => {
    await db.folders.put({
      id: folderId,
      ownerId: null,
      name: copy.seed.folderName,
      parentId: null,
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: now,
      updatedAt: now,
      dirty: false,
      lastSyncedAt: null,
      deletedAt: null,
    });

    await db.snippets.put({
      id: snippetId,
      ownerId: null,
      folderId,
      title: copy.seed.snippetName,
      code: copy.seed.snippetContent,
      language: "markdown",
      isPinnedAside: false,
      isPinnedHome: true,
      createdAt: now,
      updatedAt: now,
      dirty: false,
      lastSyncedAt: null,
      deletedAt: null,
    });
  });

  return true;
}

/**
 * Loads the first workspace state that is safe to paint. Anonymous first-time
 * visitors receive their welcome records before the snapshot is read, so the
 * UI never renders an empty state that immediately shifts to seeded content.
 */
export async function readInitialWorkspace(
  copy: Dictionary,
  userId: string | null,
): Promise<WorkspaceSnapshot> {
  if (!userId) await seedWelcomeContent(copy);
  return readWorkspace(userId);
}
