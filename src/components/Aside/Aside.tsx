"use client";

import { useEffect, useState } from "react";
import { FilePlus, FolderPlus, Home, Layers } from "lucide-react";

import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { getSupabaseBrowserClient } from "@/lib/supabase";

import type { AsideProps, AsideCtxShape, MenuTarget } from "./types";
import { sortByPinThenAlpha, isDescendantOrSelf } from "./utils";
import { AsideCtx } from "./AsideContext";
import { AsideHeader } from "./AsideHeader";
import { FolderNode } from "./FolderNode";
import { SnippetNode } from "./SnippetNode";
import { NewFolderInput } from "./NewFolderInput";
import { useContextMenuGroups } from "./useContextMenuGroups";

export type { AsideProps } from "./types";

export function Aside({
  user,
  folders,
  snippets,
  copy,
  clipboard,
  onSelectSnippet,
  onGoHome,
  onGoSpace,
  onNewSnippetAt,
  onCreateFolder,
  onDeleteFolder,
  onDeleteSnippet,
  onRenameFolder,
  onRenameSnippet,
  onPinFolder,
  onPinSnippet,
  onCut,
  onCopy,
  onPaste,
  onMoveFolder,
  onMoveSnippet,
  onSelectFolder,
  isOpen,
  isMobile,
  onSetOpen,
}: AsideProps) {
  /* ── State ─────────────────────────────────────────────────────────────── */

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    string | null | undefined
  >(undefined);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [dragging, setDragging] = useState<{ type: "folder" | "snippet"; id: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | "root" | null>(null);

  /* ── Auth ───────────────────────────────────────────────────────────────── */

  const supabase = getSupabaseBrowserClient();

  const handleSignIn = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  /* ── Drag cursor effect ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (dragging) {
      document.body.style.cursor = "grabbing";
    } else {
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [dragging]);

  /* ── Context menu groups ────────────────────────────────────────────────── */

  const buildMenuGroups = useContextMenuGroups({
    copy,
    clipboard,
    folders,
    snippets,
    onGoHome,
    onNewSnippetAt,
    onPaste,
    onPinFolder,
    onPinSnippet,
    onDeleteFolder,
    onDeleteSnippet,
    onCut,
    onCopy,
    setRenamingId,
    setCreatingFolderParentId,
  });

  /* ── Drag & Drop helpers ────────────────────────────────────────────────── */

  function canDropOnFolder(folderId: string): boolean {
    if (!dragging) return false;
    if (dragging.type === "folder") {
      return !isDescendantOrSelf(folders, dragging.id, folderId);
    }
    return true;
  }

  function dropOnTarget(targetFolderId: string | null) {
    if (!dragging) return;
    if (dragging.type === "folder") {
      if (targetFolderId !== null && !canDropOnFolder(targetFolderId)) return;
      void onMoveFolder(dragging.id, targetFolderId);
    } else {
      void onMoveSnippet(dragging.id, targetFolderId);
    }
    setDragging(null);
    setDragOverId(null);
  }

  /* ── Context value ──────────────────────────────────────────────────────── */

  const ctxValue: AsideCtxShape = {
    copy,
    renamingId,
    creatingFolderParentId,
    openMenu: (target) => setMenuTarget(target),
    beginRename: (id) => setRenamingId(id),
    submitFolderRename: (id, value) => {
      const name = value.trim();
      if (name) void onRenameFolder(id, name);
      setRenamingId(null);
    },
    submitSnippetRename: (id, value) => {
      const title = value.trim();
      if (title) void onRenameSnippet(id, title);
      setRenamingId(null);
    },
    cancelRename: () => setRenamingId(null),
    beginCreateFolder: (parentId) => setCreatingFolderParentId(parentId),
    cancelCreateFolder: () => setCreatingFolderParentId(undefined),
    submitCreateFolder: (parentId, name) => {
      void onCreateFolder(parentId, name);
      setCreatingFolderParentId(undefined);
    },
    selectSnippet: onSelectSnippet,
    selectFolder: (id: string) => onSelectFolder?.(id),
    pinFolder: onPinFolder,
    pinSnippet: onPinSnippet,
    dragging,
    dragOverId,
    startDrag: (type, id) => { setDragging({ type, id }); setDragOverId(null); },
    endDrag: () => { setDragging(null); setDragOverId(null); },
    enterDropTarget: (id) => setDragOverId(id),
    dropOnTarget,
    canDropOnFolder,
    folders,
  };

  /* ── Tree data ─────────────────────────────────────────────────────────── */

  const rootFolders    = folders.filter((f) => f.parentId === null);
  const rootSnippets   = snippets.filter((s) => s.folderId === null);
  const pinnedFolders  = sortByPinThenAlpha(rootFolders.filter((f) =>  f.isPinnedAside), (f) => f.name);
  const pinnedSnippets = sortByPinThenAlpha(rootSnippets.filter((s) =>  s.isPinnedAside), (s) => s.title ?? "");
  const unpinnedFolders  = sortByPinThenAlpha(rootFolders.filter((f) => !f.isPinnedAside), (f) => f.name);
  const unpinnedSnippets = sortByPinThenAlpha(rootSnippets.filter((s) => !s.isPinnedAside), (s) => s.title ?? "");
  const isEmpty = rootFolders.length === 0 && rootSnippets.length === 0;

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <AsideCtx.Provider value={ctxValue}>
      {menuTarget && (
        <ContextMenu
          x={menuTarget.x}
          y={menuTarget.y}
          groups={buildMenuGroups(menuTarget)}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={() => onSetOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out${
          isOpen && isMobile ? " opacity-100" : " pointer-events-none opacity-0"
        }`}
      />

      {/* Desktop: width-animating wrapper | Mobile: display:contents passthrough */}
      <div
        className={
          isMobile
            ? "contents"
            : `overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]${
                isOpen ? " w-[240px]" : " w-0"
              }`
        }
      >
        <aside
          className={[
            "flex h-screen w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-surface",
            isMobile
              ? `fixed inset-y-0 left-0 z-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <AsideHeader
            user={user}
            copy={copy}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onCollapse={() => onSetOpen(false)}
          />

          <div className="mx-4 mb-2 border-t border-white/[0.05]" />

          {/* Home */}
          <div className="px-2">
            <button
              type="button"
              onClick={onGoHome}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
            >
              <Home size={14} className="shrink-0" />
              <span>{copy.aside.home}</span>
            </button>
          </div>

          <div className="mx-4 my-3 border-t border-white/[0.05]" />

          {/* My Space */}
          <div className="flex flex-1 flex-col overflow-hidden px-2">
            <div className="mb-2 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={onGoSpace}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-white/[0.04] hover:text-foreground"
              >
                <Layers size={12} className="text-white/25" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                  {copy.aside.mySpace}
                </span>
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title={copy.aside.addSnippet}
                  onClick={() => { onGoHome(); onNewSnippetAt(null); }}
                  className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
                >
                  <FilePlus size={13} />
                </button>
                <button
                  type="button"
                  title={copy.aside.addFolder}
                  onClick={() => setCreatingFolderParentId(null)}
                  className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
                >
                  <FolderPlus size={13} />
                </button>
              </div>
            </div>

            {/* Tree */}
            <div
              className="flex-1 overflow-y-auto pb-4"
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuTarget({ type: "root", x: e.clientX, y: e.clientY });
              }}
            >
              {isEmpty && creatingFolderParentId === undefined ? (
                <p className="px-3 pt-1 text-xs text-white/20">{copy.aside.emptySpace}</p>
              ) : (
                <div>
                  {creatingFolderParentId === null && (
                    <NewFolderInput depth={0} parentId={null} />
                  )}
                  {pinnedFolders.map((folder) => (
                    <FolderNode key={folder.id} folder={folder} folders={folders} snippets={snippets} depth={0} />
                  ))}
                  {pinnedSnippets.map((snippet) => (
                    <SnippetNode key={snippet.id} snippet={snippet} depth={0} />
                  ))}
                  {unpinnedFolders.map((folder) => (
                    <FolderNode key={folder.id} folder={folder} folders={folders} snippets={snippets} depth={0} />
                  ))}
                  {unpinnedSnippets.map((snippet) => (
                    <SnippetNode key={snippet.id} snippet={snippet} depth={0} />
                  ))}
                </div>
              )}

              {/* Root drop zone */}
              {dragging && (
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragOverId("root"); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => { e.preventDefault(); dropOnTarget(null); }}
                  className={[
                    "mx-1 mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-[11px] transition-all duration-150 select-none",
                    dragOverId === "root"
                      ? "border-white/30 bg-white/[0.05] text-white/55"
                      : "border-white/[0.08] text-white/20",
                  ].join(" ")}
                >
                  <Layers size={11} />
                  {copy.aside.dropToRoot}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AsideCtx.Provider>
  );
}
