"use client";

import { startTransition, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";

import { readWorkspace } from "@/lib/db";
import type { ClipboardEntry } from "@/lib/types";
import { getDictionary } from "@/i18n";
import { SPACE_ROOT_ID } from "@/lib/navigation";

import { useResponsiveSidebar } from "@/hooks/useResponsiveSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useWorkspaceMutations } from "@/hooks/useWorkspaceMutations";

import { AccountToast } from "@/components/AccountToast/AccountToast";
import { Aside } from "@/components/Aside/Aside";
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

  /* ── Navigation & clipboard state ─────────────────────────────────────── */

  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [defaultNewSnippetFolderId, setDefaultNewSnippetFolderId] = useState<string | null>(null);

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
      setSelectedFolderId(null);
    }
  }, [folders, selectedFolderId, workspaceQuery.isSuccess]);

  const selectedSnippet = selectedSnippetId
    ? (snippets.find((s) => s.id === selectedSnippetId) ?? null)
    : null;

  function handleNewSnippetAt(folderId: string | null) {
    setSelectedSnippetId(null);
    setDefaultNewSnippetFolderId(folderId);
  }

  const menuButton = !sidebarOpen ? (
    <button
      type="button"
      title={copy.aside.open}
      onClick={() => setSidebarOpen(true)}
      className="shrink-0 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
    >
      <Menu size={16} />
    </button>
  ) : null;

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
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
        onSelectSnippet={setSelectedSnippetId}
        onGoHome={() => {
          setSelectedSnippetId(null);
          setSelectedFolderId(null);
        }}
        onGoSpace={() => {
          setSelectedSnippetId(null);
          setSelectedFolderId(SPACE_ROOT_ID);
        }}
        onNewSnippetAt={handleNewSnippetAt}
        onCreateSnippetInline={mutations.handleCreateSnippetInline}
        onCreateFolder={mutations.handleCreateFolder}
        onDeleteFolder={mutations.handleDeleteFolder}
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
        onSelectFolder={(folderId) => {
          setSelectedSnippetId(null);
          setSelectedFolderId(folderId);
        }}
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
              onClose={() => setSelectedSnippetId(null)}
              onNavigateFolder={(folderId) => {
                setSelectedSnippetId(null);
                setSelectedFolderId(folderId);
              }}
              onNavigateHome={() => {
                setSelectedSnippetId(null);
                setSelectedFolderId(SPACE_ROOT_ID);
              }}
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
            onSelectSnippet={setSelectedSnippetId}
            onNavigateFolder={setSelectedFolderId}
            onNavigateHome={() => setSelectedFolderId(SPACE_ROOT_ID)}
            onPinSnippet={mutations.handlePinSnippet}
            onPinFolder={mutations.handlePinFolder}
            onDeleteSnippet={mutations.handleDeleteSnippet}
            onRenameSnippet={mutations.handleRenameSnippet}
            onCutSnippet={(id) => setClipboard({ type: "cut", itemType: "snippet", id })}
            onCopySnippet={(id) => setClipboard({ type: "copy", itemType: "snippet", id })}
            onDeleteFolder={mutations.handleDeleteFolder}
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
                onSelectSnippet={setSelectedSnippetId}
                onNavigateFolder={setSelectedFolderId}
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
  );
}