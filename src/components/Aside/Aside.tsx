"use client";

import { useState } from "react";
import { FilePlus, FolderPlus, Home, Keyboard, Layers, RotateCcw, Search, Settings, Trash2 } from "lucide-react";

import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { isEditableTarget } from "@/lib/constants/shortcuts";
import { Tooltip } from "@/ui/Tooltip";
import { ShortcutHint } from "@/ui/ShortcutHint";

import type { AsideProps, AsideCtxShape, MenuTarget } from "./types";
import { sortByPinThenAlpha } from "./utils";
import { useMultiSelection } from "@/hooks/useMultiSelection";
import { AsideCtx } from "./AsideContext";
import { AsideHeader } from "./AsideHeader";
import { FolderNode } from "./FolderNode";
import { PinnedDivider } from "./PinnedAccent";
import { SnippetNode } from "./SnippetNode";
import { NewFolderInput } from "./NewFolderInput";
import { useContextMenuGroups } from "./useContextMenuGroups";
import { GitHubIcon } from "./GitHubIcon";

export type { AsideProps } from "./types";

export function Aside({
  user,
  authReady,
  folders,
  snippets,
  copy,
  clipboard,
  onSelectSnippet,
  onGoHome,
  onOpenSearch,
  onOpenShortcuts,
  onOpenPreferences,
  onGoSpace,
  onOpenCreateModal,
  onCreateFolder,
  onDeleteFolder,
  onDeleteSnippet,
  onDeleteMany,
  onRenameFolder,
  onRenameSnippet,
  onPinFolder,
  onPinSnippet,
  onCut,
  onCopy,
  onPaste,
  onSelectFolder,
  onSignIn,
  onSignOut,
  signingIn,
  signingOut,
  onOpenTrash,
  onRestoreAll,
  onEmptyTrash,
  trashCount,
  selectedSnippetId,
  selectedFolderId,
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
  const [trashMenu, setTrashMenu] = useState<{ x: number; y: number } | null>(null);
  const drag = useDragCtx();

  /* ── Multi-selection ────────────────────────────────────────────────────── */

  const {
    selectedIds,
    containerRef: treeContainerRef,
    activateItem,
    selectAll,
    clear: clearSelection,
    isItemSelected,
    selectForMenu,
    getSelectedItems,
    pasteTargetFolderId,
  } = useMultiSelection({
    folders,
    snippets,
    selectSnippet: onSelectSnippet,
    selectFolder: (id) => onSelectFolder?.(id),
  });

  async function handleBatchDelete() {
    const items = getSelectedItems();
    if (items.length === 0) return;
    clearSelection();
    await onDeleteMany(items);
  }

  function handleTreeKeyDown(e: React.KeyboardEvent) {
    // Never hijack the rename / inline-create inputs that live inside the tree.
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === "a") {
      e.preventDefault();
      selectAll();
      return;
    }

    if (selectedIds.size === 0) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void handleBatchDelete();
      return;
    }
    if (mod && key === "c") {
      e.preventDefault();
      onCopy({ type: "copy", items: getSelectedItems().map((i) => ({ itemType: i.type, id: i.id })) });
      return;
    }
    if (mod && key === "x") {
      e.preventDefault();
      onCut({ type: "cut", items: getSelectedItems().map((i) => ({ itemType: i.type, id: i.id })) });
      return;
    }
    if (mod && key === "v") {
      e.preventDefault();
      void onPaste(pasteTargetFolderId());
      return;
    }
    if (e.key === "Escape") clearSelection();
  }

  /* ── Context menu groups ────────────────────────────────────────────────── */

  const buildMenuGroups = useContextMenuGroups({
    copy,
    clipboard,
    folders,
    snippets,
    onPaste,
    onPinFolder,
    onPinSnippet,
    onDeleteFolder,
    onDeleteSnippet,
    onDeleteMany,
    onCut,
    onCopy,
    setRenamingId,
    setCreatingFolderParentId,
    onOpenCreateModal,
    selectedIds,
    getSelectedItems,
    clearSelection,
  });

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
    activateItem,
    isItemSelected,
    selectForMenu,
    isDraggingItem: (id: string) => {
      const d = drag.dragging;
      if (!d) return false;
      return d.id === id || Boolean(d.items?.some((it) => it.id === id));
    },
    selectedSnippetId,
    selectedFolderId,
    pinFolder: onPinFolder,
    pinSnippet: onPinSnippet,
    dragging: drag.dragging,
    dragOverId: drag.dragOverId,
    startDrag: (type, id) => {
      // Dragging any item that belongs to the active multi-selection drags the
      // whole set; otherwise it's a plain single-item drag.
      if (isItemSelected(id) && selectedIds.size > 1) {
        drag.startDrag(type, id, "workspace", getSelectedItems());
      } else {
        drag.startDrag(type, id);
      }
    },
    endDrag: drag.endDrag,
    enterDropTarget: drag.enterDropTarget,
    dropOnTarget: drag.dropOnFolder,
    canDropOnFolder: drag.canDropOnFolder,
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
  // The divider only earns its place when there is something on both sides.
  const hasPinnedBoundary =
    pinnedFolders.length + pinnedSnippets.length > 0 &&
    unpinnedFolders.length + unpinnedSnippets.length > 0;
  const isRootDropTarget = drag.dragging !== null && drag.dragOverId === "root";

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

      {trashMenu && (
        <ContextMenu
          x={trashMenu.x}
          y={trashMenu.y}
          groups={[
            {
              items: [
                {
                  id: "restore-all",
                  label: copy.trash.restoreAll,
                  Icon: RotateCcw,
                  onClick: onRestoreAll,
                },
              ],
            },
            {
              items: [
                {
                  id: "empty-trash",
                  label: copy.trash.emptyTrash,
                  Icon: Trash2,
                  variant: "destructive" as const,
                  onClick: onEmptyTrash,
                },
              ],
            },
          ]}
          onClose={() => setTrashMenu(null)}
        />
      )}

      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={() => onSetOpen(false)}
        className={`fixed inset-0 z-40 bg-[var(--scrim)] transition-opacity duration-300 ease-in-out${
          isOpen && isMobile ? " opacity-100" : " pointer-events-none opacity-0"
        }`}
      />

      {/* Desktop: width-animating wrapper | Mobile: display:contents passthrough */}
      <div
        className={
          isMobile
            ? "contents"
            : `overflow-hidden transition-[width] duration-300 ease-in-out${
                isOpen ? " w-60" : " w-0"
              }`
        }
      >
        <aside
          aria-label={copy.aside.mySpace}
          className={[
            "flex h-dvh w-60 shrink-0 flex-col border-r border-ink/6 bg-surface",
            isMobile
              ? `fixed inset-y-0 left-0 z-50 shadow-2xl transition-transform duration-300 ease-in-out ${
                  isOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onKeyDown={handleTreeKeyDown}
        >
          <AsideHeader
            user={user}
            authReady={authReady}
            copy={copy}
            signingIn={signingIn}
            signingOut={signingOut}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
            onCollapse={() => onSetOpen(false)}
          />

          <div className="mx-4 mb-2 border-t border-ink/5" />

          {/* Home + Search */}
          <div className="px-2">
            <button
              type="button"
              onClick={onGoHome}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <Home size={14} className="shrink-0" />
              <span>{copy.aside.home}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Search size={14} className="shrink-0" />
                <span>{copy.aside.search}</span>
              </span>
              <ShortcutHint id="search" className="max-lg:hidden" />
            </button>
          </div>

          <div className="mx-4 my-3 border-t border-ink/5" />

          {/* My Space */}
          <div className="flex flex-1 flex-col overflow-hidden px-2">
            <div className="mb-2 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={onGoSpace}
                onDragEnter={(e) => {
                  e.preventDefault();
                  drag.enterDropTarget("root");
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drag.dropOnFolder(null);
                }}
                className={[
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-ink/4 hover:text-foreground",
                  isRootDropTarget ? "bg-ink/[0.07] text-foreground ring-1 ring-inset ring-ink/[0.18]" : "",
                ].filter(Boolean).join(" ")}
              >
                <Layers size={12} className="text-ink/25" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                  {copy.aside.mySpace}
                </span>
              </button>
              <div className="flex items-center gap-0.5">
                <Tooltip content={copy.aside.addSnippet} placement="bottom">
                  <button
                    type="button"
                    aria-label={copy.aside.addSnippet}
                    onClick={() => onOpenCreateModal(null)}
                    className="rounded p-1 text-ink/30 transition-colors hover:bg-ink/6 hover:text-muted"
                  >
                    <FilePlus size={13} />
                  </button>
                </Tooltip>
                <Tooltip content={copy.aside.addFolder} placement="bottom">
                  <button
                    type="button"
                    aria-label={copy.aside.addFolder}
                    onClick={() => setCreatingFolderParentId(null)}
                    className="rounded p-1 text-ink/30 transition-colors hover:bg-ink/6 hover:text-muted"
                  >
                    <FolderPlus size={13} />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Tree */}
            <div
              ref={treeContainerRef}
              role="tree"
              aria-label={copy.aside.mySpace}
              aria-multiselectable="true"
              className="flex-1 overflow-y-auto pb-4"
              onClick={(e) => {
                // Clicking empty space below/around the rows clears the selection.
                if (e.target === e.currentTarget) clearSelection();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuTarget({ type: "root", x: e.clientX, y: e.clientY });
              }}
            >
              {isEmpty && creatingFolderParentId === undefined ? (
                <p className="px-3 pt-1 text-xs text-faint">{copy.aside.emptySpace}</p>
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
                  {hasPinnedBoundary && <PinnedDivider />}
                  {unpinnedFolders.map((folder) => (
                    <FolderNode key={folder.id} folder={folder} folders={folders} snippets={snippets} depth={0} />
                  ))}
                  {unpinnedSnippets.map((snippet) => (
                    <SnippetNode key={snippet.id} snippet={snippet} depth={0} />
                  ))}
                </div>
              )}

              {/* Root drop zone */}
              {drag.dragging && (
                <div
                  onDragEnter={(e) => { e.preventDefault(); drag.enterDropTarget("root"); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => { e.preventDefault(); drag.dropOnFolder(null); }}
                  className={[
                    "mx-1 mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-[11px] transition-all duration-150 select-none",
                    drag.dragOverId === "root"
                      ? "border-ink/30 bg-ink/5 text-ink/55"
                      : "border-ink/8 text-faint",
                  ].join(" ")}
                >
                  <Layers size={11} />
                  {copy.aside.dropToRoot}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-2 pb-4 pt-2">
            <button
              type="button"
              onClick={onOpenTrash}
              onContextMenu={(e) => {
                e.preventDefault();
                setTrashMenu({ x: e.clientX, y: e.clientY });
              }}
              onDragOver={(e) => {
                // dragover fires continuously while the cursor is over the button,
                // so it's the source of truth for the hover state — no child
                // enter/leave flicker (children are pointer-events-none anyway).
                if (drag.dragging?.origin !== "workspace") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (drag.dragOverId !== "trash-button") drag.enterDropTarget("trash-button");
              }}
              onDragLeave={(e) => {
                // Only clear when the cursor truly leaves the button (relatedTarget
                // outside it), and only if we're still the active target so we don't
                // clobber a sibling target that just took over.
                if (
                  drag.dragOverId === "trash-button" &&
                  !e.currentTarget.contains(e.relatedTarget as Node | null)
                ) {
                  drag.clearDropTarget();
                }
              }}
              onDrop={(e) => {
                if (drag.dragging?.origin !== "workspace") return;
                e.preventDefault();
                drag.dropOnTrash();
              }}
              className={[
                // Always carry a 1px (transparent) border so toggling to the
                // dashed drop-zone border only changes color, never width — an
                // animated 0→1px width renders dashes as a solid line mid-tween.
                "mb-1 flex w-full items-center rounded-md border border-transparent px-3 py-2 transition-colors duration-150",
                drag.dragging?.origin === "workspace"
                  ? "justify-center gap-1.5 border-dashed text-[11px] select-none " +
                    (drag.dragOverId === "trash-button"
                      ? "border-red-500/50 bg-red-500/10 text-danger-strong"
                      : "border-ink/10 text-faint")
                  : "gap-2 text-[13px] text-muted hover:bg-ink/4 hover:text-foreground",
              ].join(" ")}
            >
              {drag.dragging?.origin === "workspace" ? (
                <>
                  <Trash2 size={12} className="pointer-events-none shrink-0" />
                  <span className="pointer-events-none">{copy.aside.dropToTrash}</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} className="pointer-events-none shrink-0" />
                  <span className="pointer-events-none flex-1 text-left">{copy.aside.trash}</span>
                  {trashCount > 0 && (
                    <span className="pointer-events-none shrink-0 rounded-full bg-ink/8 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink/45">
                      {trashCount}
                    </span>
                  )}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <Settings size={14} className="shrink-0" />
              <span className="flex-1 text-left">{copy.aside.preferences}</span>
            </button>
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground max-lg:hidden"
            >
              <span className="flex items-center gap-2">
                <Keyboard size={14} className="shrink-0" />
                <span>{copy.aside.shortcuts}</span>
              </span>
              <ShortcutHint id="help" />
            </button>
            <a
              href="https://github.com/martinezharo/klipcode"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-center py-2 px-3 gap-2 rounded-md border border-ink/4 bg-ink/1 text-[12px] font-medium text-ink/65 shadow-sm transition-all duration-300 hover:border-ink/10 hover:bg-ink/4 hover:text-ink"
            >
              <GitHubIcon
                size={14}
                className="shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:text-ink"
              />
              <span className="truncate tracking-wide">martinezharo/klipcode</span>
            </a>
          </div>
        </aside>
      </div>
    </AsideCtx.Provider>
  );
}
