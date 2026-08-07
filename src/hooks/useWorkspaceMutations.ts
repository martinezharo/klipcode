import { useEffect, useRef } from "react";
import type { AccountUser } from "@/lib/types";
import { db, matchesOwner, readAllWorkspaceRecords, readTrash } from "@/lib/db";
import { recordDeletions } from "@/lib/sync";
import { getAuthToken } from "@/lib/authToken";
import type { ClipboardEntry, FolderRecord, SelectedItem, SnippetRecord, SyncStatus } from "@/lib/types";
import { isDescendantOrSelf } from "@/components/Aside/utils";
import {
  resolveSnippetPath,
  resolveSnippetRename,
  splitWorkspacePath,
  truncateCodeForTitlePrompt,
} from "@/lib/utils";
import { DEBOUNCE_MS } from "@/lib/constants/timing";
import type { Dictionary } from "@/i18n";

/** One trash operation, as recorded for undo (Ctrl/⌘+Z): exactly the record ids
 *  it newly trashed, plus the `deletedAt` stamp it wrote. Undo only reverts rows
 *  whose `deletedAt` still matches the stamp — anything restored, purged, or
 *  re-trashed by a later operation is left alone. */
interface UndoDeleteEntry {
  deletedAt: string;
  folderIds: string[];
  snippetIds: string[];
}

const MAX_UNDO_ENTRIES = 20;

interface UseWorkspaceMutationsOptions {
  copy: Dictionary;
  user: AccountUser | null;
  cloudConfigured: boolean;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  clipboard: ClipboardEntry | null;
  setClipboard: (entry: ClipboardEntry | null) => void;
  selectedSnippetId: string | null;
  setSelectedSnippetId: (id: string | null) => void;
  refreshWorkspace: () => void;
  patchSnippetInCache: (id: string, changes: Partial<SnippetRecord>) => void;
  scheduleCloudSync: () => void;
  settleLocally: (snippetId: string) => void;
  setSnippetStatus: (snippetId: string, status: SyncStatus) => void;
  setTitleGenerating: (snippetId: string, on: boolean) => void;
  /** User preference: auto-name untitled snippets with AI on creation. */
  autoGenerateTitle: boolean;
}

export function useWorkspaceMutations({
  copy,
  user,
  cloudConfigured,
  folders,
  snippets,
  clipboard,
  setClipboard,
  selectedSnippetId,
  setSelectedSnippetId,
  refreshWorkspace,
  patchSnippetInCache,
  scheduleCloudSync,
  settleLocally,
  setSnippetStatus,
  setTitleGenerating,
  autoGenerateTitle,
}: UseWorkspaceMutationsOptions) {
  const updateTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const undoStackRef = useRef<UndoDeleteEntry[]>([]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = updateTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  // The undo stack belongs to one workspace: drop it when the owner changes
  // (sign-in/out) so Ctrl+Z can't resurrect records across accounts.
  useEffect(() => {
    undoStackRef.current = [];
  }, [user?.id]);

  const currentOwnerId = user?.id ?? null;

  function isLiveFolderId(folderId: string | null, allFolders: FolderRecord[]): boolean {
    return folderId === null || allFolders.some((folder) => folder.id === folderId && !folder.deletedAt);
  }

  function pushUndoEntry(entry: UndoDeleteEntry) {
    if (entry.folderIds.length === 0 && entry.snippetIds.length === 0) return;
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > MAX_UNDO_ENTRIES) undoStackRef.current.shift();
  }

  function syncAfterMutation(snippetId?: string) {
    if (user && cloudConfigured) {
      scheduleCloudSync();
    } else if (snippetId) {
      settleLocally(snippetId);
    }
  }

  /**
   * For a registered user who left the title blank, ask Workers AI for a
   * short title inferred from the code and apply it in the background — the
   * snippet is already saved as "Untitled" so this never blocks creation.
   * Silently gives up on any failure (no AI binding, signed-out mid-flight,
   * network error, ...), leaving the placeholder title in place. Applies the
   * result only if the title is still untouched, so a user rename in the
   * meantime always wins.
   */
  async function generateAiTitle(snippetId: string, code: string, language: string) {
    // The caller flags the snippet as "generating" before we start so the UI
    // shimmers immediately; every exit path below must clear that flag — the
    // success path clears it together with the title patch (to avoid a flash of
    // "Untitled"), the `finally` covers every give-up path.
    let title: string | undefined;
    try {
      const accessToken = getAuthToken();
      if (!accessToken) return;

      const response = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ code: truncateCodeForTitlePrompt(code), language }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return;
      const json = (await response.json()) as { title?: unknown };
      title = typeof json.title === "string" ? json.title.trim() : undefined;
    } catch {
      return;
    } finally {
      // Leave the flag on only if we have a title to apply below; otherwise the
      // snippet keeps its "Untitled" placeholder, so stop the shimmer now.
      if (!title) setTitleGenerating(snippetId, false);
    }
    if (!title) return;

    const current = await db.snippets.get(snippetId);
    if (
      current &&
      matchesOwner(current.ownerId, currentOwnerId) &&
      !current.deletedAt &&
      current.title === copy.snippetCard.untitled
    ) {
      const updatedAt = new Date().toISOString();
      await db.snippets.update(snippetId, { title, updatedAt, dirty: true });
      patchSnippetInCache(snippetId, { title, updatedAt, dirty: true });
      setTitleGenerating(snippetId, false);
      syncAfterMutation(snippetId);
      return;
    }
    // The user renamed it (or trashed it) while we were generating — their title
    // wins; just drop the shimmer.
    setTitleGenerating(snippetId, false);
  }

  /* ── Snippet CRUD ─────────────────────────────────────────────────────── */

  async function handleCreateSnippet(data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }): Promise<string | undefined> {
    if (!data.code.trim()) return;

    const snippetId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const { folderSegments, title } = resolveSnippetPath(data.title);
    const folderId = await ensureFolderPath(
      folderSegments,
      data.folderId || null,
      timestamp,
    );
    const trimmedTitle = title.trim();
    const language = data.language.trim();

    await db.snippets.put({
      id: snippetId,
      ownerId: user?.id ?? null,
      folderId,
      title: trimmedTitle || copy.snippetCard.untitled,
      language,
      code: data.code,
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
      deletedAt: null,
    });

    setSnippetStatus(snippetId, "editing");
    refreshWorkspace();
    syncAfterMutation(snippetId);

    if (!trimmedTitle && user && autoGenerateTitle) {
      setTitleGenerating(snippetId, true);
      void generateAiTitle(snippetId, data.code, language);
    }

    return snippetId;
  }

  /** Resolve a "/"-separated chain of folder names under `startParentId`,
   *  reusing any live folder that already matches and creating the rest (VS Code
   *  style). Returns the id of the deepest folder, or `startParentId` for an
   *  empty path. */
  async function ensureFolderPath(
    segments: string[],
    startParentId: string | null,
    timestamp: string
  ): Promise<string | null> {
    const newFolders: FolderRecord[] = [];
    let parentId = startParentId;
    for (const name of segments) {
      const existing =
        folders.find((f) => f.parentId === parentId && f.name === name && !f.deletedAt) ??
        newFolders.find((f) => f.parentId === parentId && f.name === name);
      if (existing) {
        parentId = existing.id;
        continue;
      }
      const folder: FolderRecord = {
        id: crypto.randomUUID(),
        ownerId: user?.id ?? null,
        name,
        parentId,
        isPinnedAside: false,
        isPinnedHome: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        dirty: true,
        lastSyncedAt: null,
        deletedAt: null,
      };
      newFolders.push(folder);
      parentId = folder.id;
    }
    if (newFolders.length > 0) await db.folders.bulkPut(newFolders);
    return parentId;
  }

  async function handleUpdateSnippet(
    snippetId: string,
    changes: { title?: string; code?: string; language?: string }
  ) {
    setSnippetStatus(snippetId, "editing");

    const existing = updateTimersRef.current.get(snippetId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      updateTimersRef.current.delete(snippetId);

      const current = await db.snippets.get(snippetId);
      if (!current || !matchesOwner(current.ownerId, currentOwnerId) || current.deletedAt) return;

      const updatedAt = new Date().toISOString();
      await db.snippets.update(snippetId, {
        ...changes,
        updatedAt,
        dirty: true,
      });

      // Patch the single record in the cache instead of invalidating (and thus
      // re-reading the entire workspace) on every debounced keystroke.
      patchSnippetInCache(snippetId, { ...changes, updatedAt, dirty: true });

      if (user && cloudConfigured) {
        scheduleCloudSync();
      } else {
        settleLocally(snippetId);
      }
    }, DEBOUNCE_MS);

    updateTimersRef.current.set(snippetId, timer);
  }

  async function handleDeleteSnippet(id: string) {
    // Cancel any pending debounced update so it can't write the row back after
    // we trash it (and trigger a pointless cloud sync).
    const pendingTimer = updateTimersRef.current.get(id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      updateTimersRef.current.delete(id);
    }

    const { snippets: currentSnippets } = await readAllWorkspaceRecords(currentOwnerId);
    const existing = currentSnippets.find((snippet) => snippet.id === id);
    if (!existing) return;

    // Soft delete: mark it deleted and dirty so the trash state uploads as a
    // normal field change (the cloud row is kept, with deleted_at set, so the
    // trash syncs to other devices). It's hidden from the workspace either way.
    const now = new Date().toISOString();
    await db.snippets.update(id, { deletedAt: now, updatedAt: now, dirty: true });
    if (!existing.deletedAt) pushUndoEntry({ deletedAt: now, folderIds: [], snippetIds: [id] });

    if (selectedSnippetId === id) setSelectedSnippetId(null);
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Restore a trashed snippet. With `targetFolderId` (a drag-and-drop drop), it
   *  lands in that folder; otherwise it returns to its original folder, or to the
   *  root if that folder is gone or still trashed. */
  async function handleRestoreSnippet(id: string, targetFolderId?: string | null) {
    const { folders: allFolders, snippets: currentSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const snippet = currentSnippets.find((item) => item.id === id);
    if (!snippet) return;

    let folderId: string | null;
    if (targetFolderId !== undefined) {
      folderId = isLiveFolderId(targetFolderId, allFolders) ? targetFolderId : null;
    } else {
      folderId = snippet.folderId;
      if (folderId) {
        const parent = allFolders.find((folder) => folder.id === folderId);
        if (!parent || parent.deletedAt) folderId = null;
      }
    }

    const now = new Date().toISOString();
    await db.snippets.update(id, { deletedAt: null, folderId, dirty: true, updatedAt: now });

    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Permanently remove a trashed snippet: purge it locally and queue the cloud
   *  delete (with retry via the tombstone) for records that reached the cloud. */
  async function handlePermanentlyDeleteSnippet(id: string) {
    const { snippets: currentSnippets } = await readAllWorkspaceRecords(currentOwnerId);
    const existing = currentSnippets.find((snippet) => snippet.id === id);
    if (!existing) return;
    await db.snippets.delete(id);

    if (user && cloudConfigured && existing?.lastSyncedAt != null) {
      await recordDeletions(user.id, [{ id, kind: "snippet" }]);
      scheduleCloudSync();
    }

    if (selectedSnippetId === id) setSelectedSnippetId(null);
    refreshWorkspace();
  }

  async function handleRenameSnippet(id: string, value: string) {
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet) return;
    // The rename field carries the full filename (with extension), so resolve it
    // back into a stored title + language: a recognized extension changes the
    // language, an unknown one keeps the previous extension. See resolveSnippetRename.
    const { title, language } = resolveSnippetRename(value, snippet.language);
    await db.snippets.update(id, { title, language, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  async function handlePinSnippet(id: string, target: "aside" | "home", pinned: boolean) {
    const field = target === "aside" ? "isPinnedAside" : "isPinnedHome";
    await db.snippets.update(id, { [field]: pinned, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  async function handleMoveSnippet(id: string, newFolderId: string | null) {
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet || snippet.folderId === newFolderId || !isLiveFolderId(newFolderId, folders)) return;
    await db.snippets.update(id, {
      folderId: newFolderId,
      updatedAt: new Date().toISOString(),
      dirty: true,
    });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /* ── Folder CRUD ──────────────────────────────────────────────────────── */

  async function handleCreateFolder(parentId: string | null, name: string) {
    // A "/"-separated name creates a nested chain (VS Code style): `scripts/js`
    // makes `scripts` then `js` inside it, reusing any folder that already exists.
    const segments = splitWorkspacePath(name);
    if (segments.length === 0) return;
    const timestamp = new Date().toISOString();
    await ensureFolderPath(segments, parentId ?? null, timestamp);
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Collect a folder id and all of its descendant folder ids. */
  function collectFolderSubtree(rootId: string, allFolders: FolderRecord[]): Set<string> {
    const subtree = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const f of allFolders) {
        if (f.parentId === cur && !subtree.has(f.id)) {
          subtree.add(f.id);
          queue.push(f.id);
        }
      }
    }
    return subtree;
  }

  async function handleDeleteFolder(id: string) {
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    if (!allFolders.some((folder) => folder.id === id)) return;
    const subtree = collectFolderSubtree(id, allFolders);
    const snippetsInSubtree = allSnippets.filter((s) => s.folderId && subtree.has(s.folderId));
    const foldersInSubtree = allFolders.filter((f) => subtree.has(f.id));

    // Soft delete the whole subtree at once, marking each row dirty so the trash
    // state syncs to the cloud. Already-trashed descendants keep their original
    // deletion time so they don't jump to the top of the trash.
    const now = new Date().toISOString();
    await db.transaction("rw", [db.folders, db.snippets], async () => {
      await db.folders.bulkPut(
        foldersInSubtree.map((f) => ({ ...f, deletedAt: f.deletedAt ?? now, updatedAt: now, dirty: true }))
      );
      await db.snippets.bulkPut(
        snippetsInSubtree.map((s) => ({ ...s, deletedAt: s.deletedAt ?? now, updatedAt: now, dirty: true }))
      );
    });
    pushUndoEntry({
      deletedAt: now,
      folderIds: foldersInSubtree.filter((f) => !f.deletedAt).map((f) => f.id),
      snippetIds: snippetsInSubtree.filter((s) => !s.deletedAt).map((s) => s.id),
    });

    if (selectedSnippetId && snippetsInSubtree.some((s) => s.id === selectedSnippetId)) {
      setSelectedSnippetId(null);
    }

    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Restore a trashed folder and every trashed record beneath it. With
   *  `targetParentId` (a drag-and-drop drop) the folder lands under that parent;
   *  otherwise it keeps its parent, detaching to the root if that parent is gone
   *  or still trashed. */
  async function handleRestoreFolder(id: string, targetParentId?: string | null) {
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const folder = allFolders.find((f) => f.id === id);
    if (!folder) return;

    const subtree = collectFolderSubtree(id, allFolders);

    let parentId: string | null;
    if (
      targetParentId !== undefined &&
      isLiveFolderId(targetParentId, allFolders) &&
      !subtree.has(targetParentId ?? "")
    ) {
      parentId = targetParentId;
    } else {
      parentId = folder.parentId;
      if (parentId && !subtree.has(parentId)) {
        const parent = allFolders.find((f) => f.id === parentId);
        if (!parent || parent.deletedAt) parentId = null;
      }
    }

    const foldersToRestore = allFolders.filter((f) => subtree.has(f.id) && f.deletedAt);
    const snippetsToRestore = allSnippets.filter((s) => s.folderId && subtree.has(s.folderId) && s.deletedAt);

    const now = new Date().toISOString();
    await db.transaction("rw", [db.folders, db.snippets], async () => {
      await db.folders.bulkPut(
        foldersToRestore.map((f) => ({
          ...f,
          deletedAt: null,
          dirty: true,
          updatedAt: now,
          parentId: f.id === id ? parentId : f.parentId,
        }))
      );
      await db.snippets.bulkPut(
        snippetsToRestore.map((s) => ({ ...s, deletedAt: null, dirty: true, updatedAt: now }))
      );
    });

    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Permanently remove a trashed folder and its subtree: purge locally and queue
   *  the cloud delete for the rows that reached the cloud. */
  async function handlePermanentlyDeleteFolder(id: string) {
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    if (!allFolders.some((folder) => folder.id === id)) return;
    const subtree = collectFolderSubtree(id, allFolders);
    const foldersInSubtree = allFolders.filter((f) => subtree.has(f.id));
    const snippetsInSubtree = allSnippets.filter((s) => s.folderId && subtree.has(s.folderId));
    const snippetIds = snippetsInSubtree.map((s) => s.id);

    await db.transaction("rw", [db.folders, db.snippets], async () => {
      await db.folders.bulkDelete([...subtree]);
      await db.snippets.bulkDelete(snippetIds);
    });

    if (user && cloudConfigured) {
      const tombstones = [
        ...foldersInSubtree
          .filter((f) => f.lastSyncedAt != null)
          .map((f) => ({ id: f.id, kind: "folder" as const })),
        ...snippetsInSubtree
          .filter((s) => s.lastSyncedAt != null)
          .map((s) => ({ id: s.id, kind: "snippet" as const })),
      ];
      if (tombstones.length > 0) {
        await recordDeletions(user.id, tombstones);
        scheduleCloudSync();
      }
    }

    if (selectedSnippetId && snippetIds.includes(selectedSnippetId)) {
      setSelectedSnippetId(null);
    }

    refreshWorkspace();
  }

  /* ── Trash (bulk) ─────────────────────────────────────────────────────── */

  /** Permanently purge the entire trash for the current owner: remove locally and
   *  queue the cloud delete for the rows that reached the cloud. */
  async function handleEmptyTrash() {
    const trash = await readTrash(user?.id ?? null);
    const folderIds = trash.folders.map((f) => f.id);
    const snippetIds = trash.snippets.map((s) => s.id);
    if (folderIds.length === 0 && snippetIds.length === 0) return;

    await db.transaction("rw", [db.folders, db.snippets], async () => {
      if (folderIds.length > 0) await db.folders.bulkDelete(folderIds);
      if (snippetIds.length > 0) await db.snippets.bulkDelete(snippetIds);
    });

    if (user && cloudConfigured) {
      const tombstones = [
        ...trash.folders
          .filter((f) => f.lastSyncedAt != null)
          .map((f) => ({ id: f.id, kind: "folder" as const })),
        ...trash.snippets
          .filter((s) => s.lastSyncedAt != null)
          .map((s) => ({ id: s.id, kind: "snippet" as const })),
      ];
      if (tombstones.length > 0) {
        await recordDeletions(user.id, tombstones);
        scheduleCloudSync();
      }
    }

    if (selectedSnippetId && snippetIds.includes(selectedSnippetId)) {
      setSelectedSnippetId(null);
    }

    refreshWorkspace();
  }

  /** Restore everything in the trash. References among restored records stay
   *  valid; only references to a record that no longer exists are detached. */
  async function handleRestoreAll() {
    const trash = await readTrash(user?.id ?? null);
    if (trash.folders.length === 0 && trash.snippets.length === 0) return;

    const { folders: allFolders } = await readAllWorkspaceRecords(currentOwnerId);
    const allFolderIds = new Set(allFolders.map((f) => f.id));
    const now = new Date().toISOString();

    await db.transaction("rw", [db.folders, db.snippets], async () => {
      await db.folders.bulkPut(
        trash.folders.map((f) => ({
          ...f,
          deletedAt: null,
          dirty: true,
          updatedAt: now,
          parentId: f.parentId && allFolderIds.has(f.parentId) ? f.parentId : null,
        }))
      );
      await db.snippets.bulkPut(
        trash.snippets.map((s) => ({
          ...s,
          deletedAt: null,
          dirty: true,
          updatedAt: now,
          folderId: s.folderId && allFolderIds.has(s.folderId) ? s.folderId : null,
        }))
      );
    });

    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Undo the most recent trash operation (Ctrl/⌘+Z): restore exactly the rows
   *  that operation trashed. Rows the user has since restored, purged, or
   *  re-trashed are skipped (their `deletedAt` no longer matches the entry); an
   *  entry with nothing left to revert falls through to the one below it.
   *  Returns whether anything was actually restored. */
  async function handleUndoDelete(): Promise<boolean> {
    while (undoStackRef.current.length > 0) {
      const entry = undoStackRef.current.pop()!;
      const [folderRows, snippetRows] = await Promise.all([
        db.folders.bulkGet(entry.folderIds),
        db.snippets.bulkGet(entry.snippetIds),
      ]);
      const foldersToRestore = folderRows.filter(
        (f): f is FolderRecord =>
          !!f && matchesOwner(f.ownerId, currentOwnerId) && f.deletedAt === entry.deletedAt
      );
      const snippetsToRestore = snippetRows.filter(
        (s): s is SnippetRecord =>
          !!s && matchesOwner(s.ownerId, currentOwnerId) && s.deletedAt === entry.deletedAt
      );
      if (foldersToRestore.length === 0 && snippetsToRestore.length === 0) continue;

      // A parent reference is kept only if it points into this restored batch or
      // at a live folder; a purged or still-trashed container detaches to root so
      // nothing comes back invisible.
      const { folders: allFolders } = await readAllWorkspaceRecords(currentOwnerId);
      const validParentIds = new Set([
        ...foldersToRestore.map((f) => f.id),
        ...allFolders.filter((f) => !f.deletedAt).map((f) => f.id),
      ]);

      const now = new Date().toISOString();
      await db.transaction("rw", [db.folders, db.snippets], async () => {
        if (foldersToRestore.length > 0) {
          await db.folders.bulkPut(
            foldersToRestore.map((f) => ({
              ...f,
              deletedAt: null,
              dirty: true,
              updatedAt: now,
              parentId: f.parentId && validParentIds.has(f.parentId) ? f.parentId : null,
            }))
          );
        }
        if (snippetsToRestore.length > 0) {
          await db.snippets.bulkPut(
            snippetsToRestore.map((s) => ({
              ...s,
              deletedAt: null,
              dirty: true,
              updatedAt: now,
              folderId: s.folderId && validParentIds.has(s.folderId) ? s.folderId : null,
            }))
          );
        }
      });

      refreshWorkspace();
      if (user && cloudConfigured) scheduleCloudSync();
      return true;
    }
    return false;
  }

  async function handleRenameFolder(id: string, name: string) {
    await db.folders.update(id, { name, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  async function handlePinFolder(id: string, target: "aside" | "home", pinned: boolean) {
    const field = target === "aside" ? "isPinnedAside" : "isPinnedHome";
    await db.folders.update(id, { [field]: pinned, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  async function handleMoveFolder(id: string, newParentId: string | null) {
    const folder = folders.find((f) => f.id === id);
    if (
      !folder ||
      folder.parentId === newParentId ||
      !isLiveFolderId(newParentId, folders) ||
      (newParentId !== null && isDescendantOrSelf(folders, id, newParentId))
    ) {
      return;
    }
    await db.folders.update(id, {
      parentId: newParentId,
      updatedAt: new Date().toISOString(),
      dirty: true,
    });
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /* ── Clipboard ────────────────────────────────────────────────────────── */

  /**
   * Deep-copies a folder and all of its descendant folders/snippets under a new
   * parent, assigning fresh ids and remapping the parent/folder references so
   * the duplicated subtree is fully independent of the original.
   */
  async function duplicateFolderTree(
    sourceFolderId: string,
    targetParentId: string | null,
    timestamp: string
  ) {
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const liveFolders = allFolders.filter((folder) => !folder.deletedAt);
    const liveSnippets = allSnippets.filter((snippet) => !snippet.deletedAt);

    // Collect the source folder and every descendant folder.
    if (!liveFolders.some((folder) => folder.id === sourceFolderId)) return;
    const subtreeIds = new Set<string>([sourceFolderId]);
    const queue = [sourceFolderId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const folder of liveFolders) {
        if (folder.parentId === current && !subtreeIds.has(folder.id)) {
          subtreeIds.add(folder.id);
          queue.push(folder.id);
        }
      }
    }

    // Map every original folder id to its freshly generated copy id.
    const idMap = new Map<string, string>();
    for (const id of subtreeIds) idMap.set(id, crypto.randomUUID());

    const newFolders: FolderRecord[] = [];
    for (const folder of liveFolders) {
      if (!subtreeIds.has(folder.id)) continue;
      const isRoot = folder.id === sourceFolderId;
      newFolders.push({
        ...folder,
        id: idMap.get(folder.id)!,
        ownerId: user?.id ?? null,
        parentId: isRoot ? targetParentId : idMap.get(folder.parentId!) ?? targetParentId,
        createdAt: timestamp,
        updatedAt: timestamp,
        dirty: true,
        lastSyncedAt: null,
      });
    }

    const newSnippets: SnippetRecord[] = [];
    for (const snippet of liveSnippets) {
      if (!snippet.folderId || !subtreeIds.has(snippet.folderId)) continue;
      newSnippets.push({
        ...snippet,
        id: crypto.randomUUID(),
        ownerId: user?.id ?? null,
        folderId: idMap.get(snippet.folderId)!,
        createdAt: timestamp,
        updatedAt: timestamp,
        dirty: true,
        lastSyncedAt: null,
      });
    }

    await db.transaction("rw", [db.folders, db.snippets], async () => {
      if (newFolders.length > 0) await db.folders.bulkPut(newFolders);
      if (newSnippets.length > 0) await db.snippets.bulkPut(newSnippets);
    });
  }

  async function handlePaste(targetFolderId: string | null) {
    if (!clipboard || clipboard.items.length === 0) return;
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const liveFolders = allFolders.filter((folder) => !folder.deletedAt);
    const liveSnippets = allSnippets.filter((snippet) => !snippet.deletedAt);
    if (!isLiveFolderId(targetFolderId, allFolders)) return;
    const timestamp = new Date().toISOString();
    const isCut = clipboard.type === "cut";

    // Process each buffered item in order. Cut moves the original; copy clones it
    // (folders deep-copied with the whole subtree under fresh ids).
    for (const item of clipboard.items) {
      if (item.itemType === "snippet") {
        const snippet = liveSnippets.find((candidate) => candidate.id === item.id);
        if (!snippet) continue;
        if (isCut) {
          await db.snippets.update(item.id, { folderId: targetFolderId, updatedAt: timestamp, dirty: true });
        } else {
          await db.snippets.put({
            ...snippet,
            id: crypto.randomUUID(),
            folderId: targetFolderId,
            createdAt: timestamp,
            updatedAt: timestamp,
            dirty: true,
            lastSyncedAt: null,
          });
        }
      } else {
        const folder = liveFolders.find((candidate) => candidate.id === item.id);
        if (!folder) continue;
        // A cut folder can't be pasted into itself or its own subtree.
        if (isCut) {
          if (targetFolderId !== null && isDescendantOrSelf(liveFolders, item.id, targetFolderId)) continue;
          await db.folders.update(item.id, { parentId: targetFolderId, updatedAt: timestamp, dirty: true });
        } else {
          await duplicateFolderTree(item.id, targetFolderId, timestamp);
        }
      }
    }

    if (isCut) setClipboard(null);
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /* ── Batch operations (multi-selection in the sidebar) ────────────────── */

  /** Soft-delete every selected item at once. Items that live inside a selected
   *  folder are covered by that folder's subtree delete, so they're not deleted
   *  twice (which would reset their trash timestamp). */
  async function handleDeleteMany(items: SelectedItem[]) {
    if (items.length === 0) return;
    const { folders: storedFolders, snippets: storedSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const allFolders = storedFolders.filter((folder) => !folder.deletedAt);
    const allSnippets = storedSnippets.filter((snippet) => !snippet.deletedAt);

    const selectedFolderIds = items.filter((i) => i.type === "folder").map((i) => i.id);
    const folderUnion = new Set<string>();
    for (const fid of selectedFolderIds) {
      for (const id of collectFolderSubtree(fid, allFolders)) folderUnion.add(id);
    }

    const snippetIdsToTrash = new Set<string>(
      items.filter((i) => i.type === "snippet").map((i) => i.id)
    );
    for (const s of allSnippets) {
      if (s.folderId && folderUnion.has(s.folderId)) snippetIdsToTrash.add(s.id);
    }

    const foldersToTrash = allFolders.filter((f) => folderUnion.has(f.id));
    const snippetsToTrash = allSnippets.filter((s) => snippetIdsToTrash.has(s.id));
    if (foldersToTrash.length === 0 && snippetsToTrash.length === 0) return;

    // Cancel any pending debounced updates so they can't resurrect a trashed row.
    for (const s of snippetsToTrash) {
      const timer = updateTimersRef.current.get(s.id);
      if (timer) {
        clearTimeout(timer);
        updateTimersRef.current.delete(s.id);
      }
    }

    const now = new Date().toISOString();
    await db.transaction("rw", [db.folders, db.snippets], async () => {
      if (foldersToTrash.length > 0) {
        await db.folders.bulkPut(
          foldersToTrash.map((f) => ({ ...f, deletedAt: f.deletedAt ?? now, updatedAt: now, dirty: true }))
        );
      }
      if (snippetsToTrash.length > 0) {
        await db.snippets.bulkPut(
          snippetsToTrash.map((s) => ({ ...s, deletedAt: s.deletedAt ?? now, updatedAt: now, dirty: true }))
        );
      }
    });
    pushUndoEntry({
      deletedAt: now,
      folderIds: foldersToTrash.filter((f) => !f.deletedAt).map((f) => f.id),
      snippetIds: snippetsToTrash.filter((s) => !s.deletedAt).map((s) => s.id),
    });

    if (selectedSnippetId && snippetIdsToTrash.has(selectedSnippetId)) setSelectedSnippetId(null);

    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** Move every selected item into `targetFolderId`. Items already inside a
   *  selected folder move with it (skipped here), and cycle-forming folder moves
   *  are ignored. */
  async function handleMoveMany(items: SelectedItem[], targetFolderId: string | null) {
    if (items.length === 0) return;
    const { folders: storedFolders, snippets: storedSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const allFolders = storedFolders.filter((folder) => !folder.deletedAt);
    const allSnippets = storedSnippets.filter((snippet) => !snippet.deletedAt);
    if (!isLiveFolderId(targetFolderId, allFolders)) return;

    const selectedFolderIds = items.filter((i) => i.type === "folder").map((i) => i.id);
    // Descendant folders of a selected folder travel with their ancestor.
    const covered = new Set<string>();
    for (const fid of selectedFolderIds) {
      for (const id of collectFolderSubtree(fid, allFolders)) {
        if (id !== fid) covered.add(id);
      }
    }

    const now = new Date().toISOString();
    let changed = false;
    await db.transaction("rw", [db.folders, db.snippets], async () => {
      for (const item of items) {
        if (item.type === "folder") {
          if (covered.has(item.id)) continue;
          if (targetFolderId !== null && isDescendantOrSelf(allFolders, item.id, targetFolderId)) continue;
          const folder = allFolders.find((f) => f.id === item.id);
          if (!folder || folder.parentId === targetFolderId) continue;
          await db.folders.update(item.id, { parentId: targetFolderId, updatedAt: now, dirty: true });
          changed = true;
        } else {
          const snippet = allSnippets.find((candidate) => candidate.id === item.id);
          if (!snippet) continue;
          // Skip snippets that live inside a selected folder — they move with it.
          if (snippet.folderId && (covered.has(snippet.folderId) || selectedFolderIds.includes(snippet.folderId))) continue;
          if (snippet.folderId === targetFolderId) continue;
          await db.snippets.update(item.id, { folderId: targetFolderId, updatedAt: now, dirty: true });
          changed = true;
        }
      }
    });

    if (!changed) return;
    refreshWorkspace();
    if (user && cloudConfigured) scheduleCloudSync();
  }

  /** The selection tops: items not covered by another selected folder's subtree.
   *  A covered item travels with its ancestor's restore/purge, so acting on it
   *  separately would duplicate the operation (or detach it from its folder). */
  async function selectionTops(items: SelectedItem[]): Promise<SelectedItem[]> {
    const { folders: allFolders, snippets: allSnippets } =
      await readAllWorkspaceRecords(currentOwnerId);
    const covered = new Set<string>();
    const selectedFolderIds = items.filter((i) => i.type === "folder").map((i) => i.id);
    for (const fid of selectedFolderIds) {
      for (const id of collectFolderSubtree(fid, allFolders)) {
        if (id !== fid) covered.add(id);
      }
    }
    const tops: SelectedItem[] = [];
    for (const item of items) {
      if (item.type === "folder") {
        if (!covered.has(item.id)) tops.push(item);
      } else {
        const snippet = allSnippets.find((candidate) => candidate.id === item.id);
        if (!snippet) continue;
        const parent = snippet.folderId;
        if (!parent || (!covered.has(parent) && !selectedFolderIds.includes(parent))) tops.push(item);
      }
    }
    return tops;
  }

  /** Restore every selected trashed item at once. With `targetFolderId` (a batch
   *  drag onto the tree), the tops land there; otherwise each returns to its
   *  original parent like the single-item restores. */
  async function handleRestoreMany(items: SelectedItem[], targetFolderId?: string | null) {
    for (const item of await selectionTops(items)) {
      if (item.type === "folder") await handleRestoreFolder(item.id, targetFolderId);
      else await handleRestoreSnippet(item.id, targetFolderId);
    }
  }

  /** Permanently remove every selected trashed item (and selected folders'
   *  subtrees) at once. */
  async function handlePermanentlyDeleteMany(items: SelectedItem[]) {
    for (const item of await selectionTops(items)) {
      if (item.type === "folder") await handlePermanentlyDeleteFolder(item.id);
      else await handlePermanentlyDeleteSnippet(item.id);
    }
  }

  return {
    handleCreateSnippet,
    handleUpdateSnippet,
    handleDeleteSnippet,
    handleRestoreSnippet,
    handlePermanentlyDeleteSnippet,
    handleRenameSnippet,
    handlePinSnippet,
    handleMoveSnippet,
    handleCreateFolder,
    handleDeleteFolder,
    handleRestoreFolder,
    handlePermanentlyDeleteFolder,
    handleRenameFolder,
    handlePinFolder,
    handleMoveFolder,
    handlePaste,
    handleDeleteMany,
    handleMoveMany,
    handleRestoreMany,
    handlePermanentlyDeleteMany,
    handleEmptyTrash,
    handleRestoreAll,
    handleUndoDelete,
  };
}
