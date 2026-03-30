"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";

import { readWorkspace } from "@/lib/db";
import type { ClipboardEntry } from "@/lib/types";
import { getDictionary } from "@/i18n";
import { SPACE_ROOT_ID } from "@/lib/navigation";
import { Tooltip } from "@/ui/Tooltip";

import { useResponsiveSidebar } from "@/hooks/useResponsiveSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useWorkspaceMutations } from "@/hooks/useWorkspaceMutations";

import { AccountToast } from "@/components/AccountToast/AccountToast";
import { Aside } from "@/components/Aside/Aside";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { DragProvider } from "@/components/DragContext";
import { NewSnippet } from "@/components/NewSnippet/NewSnippet";
import { SnippetCards } from "@/components/SnippetCards/SnippetCards";
import { SnippetEditor } from "@/components/SnippetEditor/SnippetEditor";
import { FolderView } from "@/components/FolderView/FolderView";

export default function KlipCodeApp() {
  const copy = getDictionary();
  const queryClient = useQueryClient();
  const { sidebarOpen, setSidebarOpen, isMobile } = useResponsiveSidebar();

  function refreshWorkspace() {
    startTransition(() => {
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "workspace",
      });
    });
  }

  // onReconciled callback references sync.setSnippetStatus — safe because it's
  // only invoked asynchronously from effects, well after all hooks initialise.
  const auth = useAuth({
    copy,
    refreshWorkspace,
    onReconciled: (ids) => {
      for (const id of ids) sync.setSnippetStatus(id, "saved-cloud");
    },
  });

  const sync = useCloudSync({
    user: auth.user,
    supabaseConfigured: auth.supabaseConfigured,
    copy,
    refreshWorkspace,
    setAccountMessage: auth.setAccountMessage,
  });

  /* ── URL-based navigation ─────────────────────────────────────────────── */

  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedSnippetId = searchParams.get("snippet");
  const selectedFolderId = searchParams.get("folder");

  /** Used by useWorkspaceMutations which needs a (id: string | null) => void setter. */
  function setSelectedSnippetId(id: string | null) {
    if (id !== null) router.push(`/?snippet=${id}`);
    else router.push("/");
  }

  /* ── Clipboard state ──────────────────────────────────────────────────── */

  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [defaultNewSnippetFolderId, setDefaultNewSnippetFolderId] = useState<string | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<{
    id: string;
    name: string;
    nestedFolderCount: number;
    snippetCount: number;
  } | null>(null);

  /* ── Workspace data ───────────────────────────────────────────────────── */

  const workspaceQuery = useQuery({
    queryKey: ["workspace", auth.user?.id ?? "guest"],
    queryFn: () => readWorkspace(auth.user?.id ?? null),
  });

  const folders = workspaceQuery.data?.folders ?? [];
  const snippets = workspaceQuery.data?.snippets ?? [];

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const mutations = useWorkspaceMutations({
    user: auth.user,
    supabase: auth.supabase,
    supabaseConfigured: auth.supabaseConfigured,
    folders,
    snippets,
    clipboard,
    setClipboard,
    selectedSnippetId,
    setSelectedSnippetId,
    refreshWorkspace,
    scheduleCloudSync: sync.scheduleCloudSync,
    settleLocally: sync.settleLocally,
    setSnippetStatus: sync.setSnippetStatus,
  });

  /* ── Derived state & side-effects ─────────────────────────────────────── */

  useEffect(() => {
    if (!workspaceQuery.isSuccess) return;
    if (selectedFolderId && selectedFolderId !== SPACE_ROOT_ID && !folders.find((f) => f.id === selectedFolderId)) {
      router.replace("/");
    }
  }, [folders, selectedFolderId, workspaceQuery.isSuccess, router]);

  const selectedSnippet = selectedSnippetId
    ? (snippets.find((s) => s.id === selectedSnippetId) ?? null)
    : null;

  function handleNewSnippetAt(folderId: string | null) {
    router.push("/");
    setDefaultNewSnippetFolderId(folderId);
  }

  async function handleDeleteFolderWithConfirm(id: string): Promise<void> {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    const folderSet = new Set<string>([id]);
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const f of folders) {
        if (f.parentId === cur && !folderSet.has(f.id)) {
          folderSet.add(f.id);
          queue.push(f.id);
        }
      }
    }

    const nestedFolderCount = folderSet.size - 1;
    const snippetCount = snippets.filter((s) => s.folderId && folderSet.has(s.folderId)).length;

    if (nestedFolderCount === 0 && snippetCount === 0) {
      await mutations.handleDeleteFolder(id);
      return;
    }

    setPendingDeleteFolder({ id, name: folder.name, nestedFolderCount, snippetCount });
  }

  const menuButton = !sidebarOpen ? (
    <Tooltip content={copy.aside.open} placement="bottom">
      <button
        type="button"
        aria-label={copy.aside.open}
        onClick={() => setSidebarOpen(true)}
        className="shrink-0 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
      >
        <Menu size={16} />
      </button>
    </Tooltip>
  ) : null;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <DragProvider
      folders={folders}
      onMoveFolder={mutations.handleMoveFolder}
      onMoveSnippet={mutations.handleMoveSnippet}
    >
    <div className="flex h-screen overflow-hidden">
      <Aside
        user={auth.user}
        folders={folders}
        snippets={snippets}
        copy={copy}
        clipboard={clipboard}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onSetOpen={setSidebarOpen}
        onSelectSnippet={(id) => router.push(`/?snippet=${id}`)}
        onGoHome={() => router.push("/")}
        onGoSpace={() => router.push(`/?folder=${SPACE_ROOT_ID}`)}
        onNewSnippetAt={handleNewSnippetAt}
        onCreateSnippetInline={mutations.handleCreateSnippetInline}
        onCreateFolder={mutations.handleCreateFolder}
        onDeleteFolder={handleDeleteFolderWithConfirm}
        onDeleteSnippet={mutations.handleDeleteSnippet}
        onRenameFolder={mutations.handleRenameFolder}
        onRenameSnippet={mutations.handleRenameSnippet}
        onPinFolder={mutations.handlePinFolder}
        onPinSnippet={mutations.handlePinSnippet}
        onCut={setClipboard}
        onCopy={(entry) => setClipboard({ ...entry, type: "copy" })}
        onPaste={mutations.handlePaste}
        onMoveFolder={mutations.handleMoveFolder}
        onMoveSnippet={mutations.handleMoveSnippet}
        onSignIn={auth.handleGitHubSignIn}
        onSignOut={auth.handleSignOut}
        onSelectFolder={(folderId) => router.push(`/?folder=${folderId}`)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AccountToast message={auth.accountMessage} />

        {selectedSnippet ? (
          <div className="flex-1 overflow-hidden">
            <SnippetEditor
              key={selectedSnippet.id}
              snippet={selectedSnippet}
              folders={folders}
              copy={copy}
              syncStatus={sync.snippetStatuses[selectedSnippet.id] ?? "idle"}
              onClose={() => router.push("/")}
              onNavigateFolder={(folderId) => router.push(`/?folder=${folderId}`)}
              onNavigateHome={() => router.push(`/?folder=${SPACE_ROOT_ID}`)}
              onUpdate={mutations.handleUpdateSnippet}
              menuButton={menuButton}
            />
          </div>
        ) : selectedFolderId ? (
          <FolderView
            folderId={selectedFolderId}
            folders={folders}
            snippets={snippets}
            copy={copy}
            clipboard={clipboard}
            onSelectSnippet={(id) => router.push(`/?snippet=${id}`)}
            onNavigateFolder={(folderId) => router.push(`/?folder=${folderId}`)}
            onNavigateHome={() => router.push(`/?folder=${SPACE_ROOT_ID}`)}
            onPinSnippet={mutations.handlePinSnippet}
            onPinFolder={mutations.handlePinFolder}
            onDeleteSnippet={mutations.handleDeleteSnippet}
            onRenameSnippet={mutations.handleRenameSnippet}
            onCutSnippet={(id) => setClipboard({ type: "cut", itemType: "snippet", id })}
            onCopySnippet={(id) => setClipboard({ type: "copy", itemType: "snippet", id })}
            onDeleteFolder={handleDeleteFolderWithConfirm}
            onRenameFolder={mutations.handleRenameFolder}
            onCutFolder={(id) => setClipboard({ type: "cut", itemType: "folder", id })}
            onCopyFolder={(id) => setClipboard({ type: "copy", itemType: "folder", id })}
            onPaste={mutations.handlePaste}
            menuButton={menuButton}
          />
        ) : (
          <main className="flex-1 overflow-y-auto">
            {menuButton && (
              <div className="sticky top-0 z-10 flex h-[44px] items-center border-b border-transparent px-3">
                {menuButton}
              </div>
            )}
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
              <NewSnippet
                copy={copy}
                folders={folders}
                defaultFolderId={defaultNewSnippetFolderId}
                onCreateSnippet={mutations.handleCreateSnippet}
              />

              <SnippetCards
                snippets={snippets}
                folders={folders}
                copy={copy}
                clipboard={clipboard}
                onSelectSnippet={(id) => router.push(`/?snippet=${id}`)}
                onNavigateFolder={(folderId) => router.push(`/?folder=${folderId}`)}
                onPinSnippet={mutations.handlePinSnippet}
                onDeleteSnippet={mutations.handleDeleteSnippet}
                onRenameSnippet={mutations.handleRenameSnippet}
                onCutSnippet={(id) => setClipboard({ type: "cut", itemType: "snippet", id })}
                onCopySnippet={(id) => setClipboard({ type: "copy", itemType: "snippet", id })}
                onPaste={mutations.handlePaste}
              />
            </div>
          </main>
        )}
      </div>
    </div>

    {pendingDeleteFolder && (
      <ConfirmDialog
        copy={copy.confirmDeleteFolder}
        folderName={pendingDeleteFolder.name}
        nestedFolderCount={pendingDeleteFolder.nestedFolderCount}
        snippetCount={pendingDeleteFolder.snippetCount}
        onCancel={() => setPendingDeleteFolder(null)}
        onConfirm={() => {
          void mutations.handleDeleteFolder(pendingDeleteFolder.id);
          setPendingDeleteFolder(null);
        }}
      />
    )}
    </DragProvider>
  );
}