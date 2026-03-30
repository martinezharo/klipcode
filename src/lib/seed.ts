import { db } from "@/lib/db";
import type { Dictionary } from "@/i18n";

const SEEDED_KEY = "klipcode.seeded";

/**
 * Seeds the local IndexedDB with a welcome folder and snippet on first visit.
 * Returns true if seeding actually happened, false if already seeded.
 */
export async function seedWelcomeContent(copy: Dictionary): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(SEEDED_KEY)) return false;

  // Set flag first to prevent duplicate concurrent calls
  localStorage.setItem(SEEDED_KEY, "1");

  const now = new Date().toISOString();
  const folderId = crypto.randomUUID();
  const snippetId = crypto.randomUUID();

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
    });
  });

  return true;
}
