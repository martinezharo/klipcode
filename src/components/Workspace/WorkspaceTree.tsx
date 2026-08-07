"use client";

import { useState } from "react";
import { FilePlus, FolderPlus, Layers } from "lucide-react";

import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { isEditableTarget } from "@/lib/constants/shortcuts";
import { Tooltip } from "@/ui/Tooltip";
import { IconButton } from "@/ui/IconButton";
import { useMultiSelection } from "@/hooks/useMultiSelection";

import { AsideCtx } from "@/components/Aside/AsideContext";
import { FolderNode } from "@/components/Aside/FolderNode";
import { PinnedDivider } from "@/components/Aside/PinnedAccent";
import { SnippetNode } from "@/components/Aside/SnippetNode";
import { NewFolderInput } from "@/components/Aside/NewFolderInput";
import { useContextMenuGroups } from "@/components/Aside/useContextMenuGroups";
import { sortByPinThenAlpha } from "@/components/Aside/utils";
import type { AsideCtxShape, MenuTarget } from "@/components/Aside/types";
import type { WorkspaceTreeProps } from "./types";

/**
 * The workspace tree — "My Space" heading, its create buttons, and the rows.
 *
 * Both shells render this same component: the desktop aside and the mobile home
 * (`MobileHome`), which is a destination rather than a drawer. Keeping one tree
 * is the point — renaming, inline folder creation, multi-selection, the context
 * / "more" menus and drag & drop are all non-trivial and must not exist twice.
 * Only the chrome around it differs per shell.
 */
export function WorkspaceTree({
  folders,
  snippets,
  copy,
  clipboard,
  selectedSnippetId,
  selectedFolderId,
  onSelectSnippet,
  onSelectFolder,
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
}: WorkspaceTreeProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    string | null | undefined
  >(undefined);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const drag = useDragCtx();

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

      <div className="flex flex-1 flex-col overflow-hidden px-2" onKeyDown={handleTreeKeyDown}>
        {/* 44px tall on touch so the create buttons' invisible hit areas fit
            inside this row. Any shorter and the tree below, which paints after
            it, covers the overhang and eats taps near the edge. */}
        <div className="mb-2 flex items-center justify-between px-2 max-lg:h-11">
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
              "flex items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-ink/4 hover:text-foreground max-lg:h-9 lg:py-1",
              isRootDropTarget ? "bg-ink/[0.07] text-foreground ring-1 ring-inset ring-ink/[0.18]" : "",
            ].filter(Boolean).join(" ")}
          >
            <Layers size={12} className="text-ink/25" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
              {copy.aside.mySpace}
            </span>
          </button>
          {/* 32px boxes + a 12px gap puts these 44px apart centre-to-centre, so
              their invisible 44px hit areas tile instead of overlapping. At
              `gap-0.5` each one would swallow half of its neighbour's taps. */}
          <div className="flex items-center max-lg:gap-3 lg:gap-0.5">
            <Tooltip content={copy.aside.addSnippet} placement="bottom">
              <IconButton
                aria-label={copy.aside.addSnippet}
                onClick={() => onOpenCreateModal(null)}
                className="text-ink/30 hover:bg-ink/6 hover:text-muted lg:p-1"
              >
                <FilePlus size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip content={copy.aside.addFolder} placement="bottom">
              <IconButton
                aria-label={copy.aside.addFolder}
                onClick={() => setCreatingFolderParentId(null)}
                className="text-ink/30 hover:bg-ink/6 hover:text-muted lg:p-1"
              >
                <FolderPlus size={14} />
              </IconButton>
            </Tooltip>
          </div>
        </div>

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
              {creatingFolderParentId === null && <NewFolderInput depth={0} parentId={null} />}
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
    </AsideCtx.Provider>
  );
}
