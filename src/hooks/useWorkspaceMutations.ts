import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import type { ClipboardEntry, FolderRecord, SnippetRecord, SyncStatus } from "@/lib/types";
import { DEFAULT_LANGUAGE } from "@/lib/constants/languages";
import { DEBOUNCE_MS } from "@/lib/constants/timing";
import type { Dictionary } from "@/i18n";

interface UseWorkspaceMutationsOptions {
  copy: Dictionary;
  user: User | null;
  supabase: SupabaseClient | null;
  supabaseConfigured: boolean;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  clipboard: ClipboardEntry | null;
  setClipboard: (entry: ClipboardEntry | null) => void;
  selectedSnippetId: string | null;
  setSelectedSnippetId: (id: string | null) => void;
  refreshWorkspace: () => void;
  scheduleCloudSync: () => void;
  settleLocally: (snippetId: string) => void;
  setSnippetStatus: (snippetId: string, status: SyncStatus) => void;
}

export function useWorkspaceMutations({
  copy,
  user,
  supabase,
  supabaseConfigured,
  folders,
  snippets,
  clipboard,
  setClipboard,
  selectedSnippetId,
  setSelectedSnippetId,
  refreshWorkspace,
  scheduleCloudSync,
  settleLocally,
  setSnippetStatus,
}: UseWorkspaceMutationsOptions) {
  const updateTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = updateTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  function syncAfterMutation(snippetId?: string) {
    if (user && supabaseConfigured) {
      scheduleCloudSync();
    } else if (snippetId) {
      settleLocally(snippetId);
    }
  }

  /* ── Snippet CRUD ─────────────────────────────────────────────────────── */

  async function handleCreateSnippet(data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }) {
    if (!data.code.trim()) return;

    const snippetId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db.snippets.put({
      id: snippetId,
      ownerId: user?.id ?? null,
      folderId: data.folderId || null,
      title: data.title.trim() || copy.snippetCard.untitled,
      language: data.language.trim(),
      code: data.code,
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });

    setSnippetStatus(snippetId, "editing");
    refreshWorkspace();
    syncAfterMutation(snippetId);
  }

  async function handleCreateSnippetInline(folderId: string | null, title: string) {
    const snippetId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db.snippets.put({
      id: snippetId,
      ownerId: user?.id ?? null,
      folderId: folderId ?? null,
      title: title.trim() || copy.snippetCard.untitled,
      language: DEFAULT_LANGUAGE,
      code: "",
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });

    setSnippetStatus(snippetId, "editing");
    refreshWorkspace();
    setSelectedSnippetId(snippetId);
    syncAfterMutation(snippetId);
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

      await db.snippets.update(snippetId, {
        ...changes,
        updatedAt: new Date().toISOString(),
        dirty: true,
      });

      refreshWorkspace();

      if (user && supabaseConfigured) {
        scheduleCloudSync();
      } else {
        settleLocally(snippetId);
      }
    }, DEBOUNCE_MS);

    updateTimersRef.current.set(snippetId, timer);
  }

  async function handleDeleteSnippet(id: string) {
    await db.snippets.delete(id);

    if (user && supabaseConfigured && supabase) {
      try {
        await supabase.from("snippets").delete().eq("id", id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to delete snippet on cloud:", err);
      }
    }

    if (selectedSnippetId === id) setSelectedSnippetId(null);
    refreshWorkspace();
  }

  async function handleRenameSnippet(id: string, title: string) {
    await db.snippets.update(id, { title, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  async function handlePinSnippet(id: string, target: "aside" | "home", pinned: boolean) {
    const field = target === "aside" ? "isPinnedAside" : "isPinnedHome";
    await db.snippets.update(id, { [field]: pinned, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  async function handleMoveSnippet(id: string, newFolderId: string | null) {
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet || snippet.folderId === newFolderId) return;
    await db.snippets.update(id, {
      folderId: newFolderId,
      updatedAt: new Date().toISOString(),
      dirty: true,
    });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  /* ── Folder CRUD ──────────────────────────────────────────────────────── */

  async function handleCreateFolder(parentId: string | null, name: string) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.folders.put({
      id,
      ownerId: user?.id ?? null,
      name,
      parentId,
      isPinnedAside: false,
      isPinnedHome: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  async function handleDeleteFolder(id: string) {
    const allFolders = await db.folders.toArray();
    const toDelete = new Set<string>([id]);
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const f of allFolders) {
        if (f.parentId === cur && !toDelete.has(f.id)) {
          toDelete.add(f.id);
          queue.push(f.id);
        }
      }
    }
    await Promise.all([...toDelete].map((fid) => db.folders.delete(fid)));

    const allSnippets = await db.snippets.toArray();
    const snippetIdsToDelete = allSnippets
      .filter((s) => s.folderId && toDelete.has(s.folderId))
      .map((s) => s.id);
    await Promise.all(snippetIdsToDelete.map((sid) => db.snippets.delete(sid)));

    if (user && supabaseConfigured && supabase) {
      try {
        if (snippetIdsToDelete.length > 0) {
          await supabase.from("snippets").delete().in("id", snippetIdsToDelete);
        }
        if (toDelete.size > 0) {
          await supabase.from("folders").delete().in("id", [...toDelete]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to delete on cloud:", err);
      }
    }

    if (selectedSnippetId && snippetIdsToDelete.includes(selectedSnippetId)) {
      setSelectedSnippetId(null);
    }

    refreshWorkspace();
  }

  async function handleRenameFolder(id: string, name: string) {
    await db.folders.update(id, { name, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  async function handlePinFolder(id: string, target: "aside" | "home", pinned: boolean) {
    const field = target === "aside" ? "isPinnedAside" : "isPinnedHome";
    await db.folders.update(id, { [field]: pinned, updatedAt: new Date().toISOString(), dirty: true });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  async function handleMoveFolder(id: string, newParentId: string | null) {
    const folder = folders.find((f) => f.id === id);
    if (!folder || folder.parentId === newParentId) return;
    await db.folders.update(id, {
      parentId: newParentId,
      updatedAt: new Date().toISOString(),
      dirty: true,
    });
    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  /* ── Clipboard ────────────────────────────────────────────────────────── */

  async function handlePaste(targetFolderId: string | null) {
    if (!clipboard) return;
    const timestamp = new Date().toISOString();

    if (clipboard.itemType === "snippet") {
      const snippet = await db.snippets.get(clipboard.id);
      if (!snippet) return;

      if (clipboard.type === "cut") {
        await db.snippets.update(clipboard.id, { folderId: targetFolderId, updatedAt: timestamp, dirty: true });
        setClipboard(null);
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
      if (clipboard.type === "cut") {
        await db.folders.update(clipboard.id, { parentId: targetFolderId, updatedAt: timestamp, dirty: true });
        setClipboard(null);
      }
    }

    refreshWorkspace();
    if (user && supabaseConfigured) scheduleCloudSync();
  }

  return {
    handleCreateSnippet,
    handleCreateSnippetInline,
    handleUpdateSnippet,
    handleDeleteSnippet,
    handleRenameSnippet,
    handlePinSnippet,
    handleMoveSnippet,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder,
    handlePinFolder,
    handleMoveFolder,
    handlePaste,
  };
}
