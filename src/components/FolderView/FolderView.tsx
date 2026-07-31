"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Clipboard, FileCode2, FilePlus, Folder, FolderOpen, FolderPlus, Layers } from "lucide-react";

import type { Dictionary } from "@/i18n";
import type { ClipboardEntry, FolderRecord, SelectedItem, SnippetRecord } from "@/lib/types";
import { SPACE_ROOT_ID, openItemInNewTab } from "@/lib/navigation";
import { isEditableTarget } from "@/lib/constants/shortcuts";
import { useMultiSelection } from "@/hooks/useMultiSelection";
import { SnippetCard } from "@/components/SnippetCards/SnippetCard";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs/Breadcrumbs";
import { ViewHeader, EmptyState, CardSection } from "@/components/ViewShell/ViewShell";
import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { FolderCard } from "./FolderCard";
import { getFolderPath, buildSnippetCountMap, buildSubFolderCountMap } from "./utils";

/* ─────────────────────────── FolderView ─────────────────────────────────── */

export interface FolderViewProps {
  folderId: string;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  clipboard?: ClipboardEntry | null;
  onSelectSnippet: (snippetId: string) => void;
  onNavigateFolder: (folderId: string) => void;
  onNavigateHome: () => void;
  onPinSnippet?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinFolder?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onDeleteSnippet?: (id: string) => Promise<void>;
  onRenameSnippet?: (id: string, title: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onRenameFolder?: (id: string, name: string) => Promise<void>;
  /** Cut/copy one item or the whole multi-selection into the app clipboard. */
  onCut?: (entry: ClipboardEntry) => void;
  onCopy?: (entry: ClipboardEntry) => void;
  /** Soft-delete the whole multi-selection at once. */
  onDeleteMany?: (items: SelectedItem[]) => Promise<void>;
  onPaste?: (targetFolderId: string | null) => Promise<void>;
  onCreateFolder?: (parentId: string | null, name: string) => Promise<void>;
  onOpenCreateModal?: (folderId: string | null) => void;
  menuButton?: ReactNode;
}

export function FolderView({
  folderId,
  folders,
  snippets,
  copy,
  clipboard,
  onSelectSnippet,
  onNavigateFolder,
  onNavigateHome,
  onPinSnippet,
  onPinFolder,
  onDeleteSnippet,
  onRenameSnippet,
  onDeleteFolder,
  onRenameFolder,
  onCut,
  onCopy,
  onDeleteMany,
  onPaste,
  onCreateFolder,
  onOpenCreateModal,
  menuButton,
}: FolderViewProps) {
  const drag = useDragCtx();

  // Inline folder creation + right-click context menu on the canvas.
  const [creating, setCreating] = useState<"folder" | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const isRootSpace = folderId === SPACE_ROOT_ID;
  const currentFolder = isRootSpace ? null : folders.find((f) => f.id === folderId);

  const parentKey = isRootSpace ? null : folderId;

  const dropTargetSentinel = parentKey ?? "space-root";
  const canDropOnCurrentFolder =
    drag.dragging !== null &&
    (drag.dragging.type === "snippet" || isRootSpace || drag.canDropOnFolder(folderId));

  // Only show the drop hint when the item doesn't already live in this folder
  const isDraggedFromOutside = drag.dragging !== null && (() => {
    if (drag.dragging!.type === "folder") {
      const f = folders.find((x) => x.id === drag.dragging!.id);
      return f ? f.parentId !== parentKey : false;
    } else {
      const s = snippets.find((x) => x.id === drag.dragging!.id);
      return s ? s.folderId !== parentKey : false;
    }
  })();

  // Show as soon as an eligible outside item is being dragged; highlight when hovering over the view
  const showDropHint = canDropOnCurrentFolder && isDraggedFromOutside;
  const isCurrentFolderDropTarget = showDropHint && drag.dragOverId === dropTargetSentinel;

  const childFolders = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === parentKey)
        .sort((a, b) => {
          if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [folders, parentKey],
  );

  const folderSnippets = useMemo(
    () =>
      snippets
        .filter((s) => s.folderId === parentKey)
        .sort((a, b) => {
          if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    [snippets, parentKey],
  );

  // Pre-compute counts so FolderCard renders don't each filter the full lists (O(n) vs O(n*m))
  const snippetCountMap = useMemo(() => buildSnippetCountMap(snippets), [snippets]);
  const subFolderCountMap = useMemo(() => buildSubFolderCountMap(folders), [folders]);

  /* ── Multi-selection (⌘/Ctrl+click, Shift+click, ⌘/Ctrl+A — like the aside) ── */

  const {
    selectedIds,
    containerRef: selectionContainerRef,
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
    selectFolder: onNavigateFolder,
  });

  // Navigating to another folder drops the selection — its cards are gone.
  useEffect(() => {
    clearSelection();
  }, [folderId, clearSelection]);

  // Bail out only after all hooks have run, so hook order stays stable across
  // renders (a missing folder otherwise skips the useMemo calls above).
  if (!isRootSpace && !currentFolder) return null;

  /** The card's menu/drag acts on the whole set only when the card is part of a
   *  multi-selection (mirrors the aside's batch semantics). */
  const isBatchSelected = (id: string) => isItemSelected(id) && selectedIds.size > 1;

  const clipboardEntryFor = (type: "cut" | "copy", item: SelectedItem): ClipboardEntry => ({
    type,
    items: (isBatchSelected(item.id) ? getSelectedItems() : [item]).map((i) => ({
      itemType: i.type,
      id: i.id,
    })),
  });

  async function handleBatchDelete() {
    const items = getSelectedItems();
    if (items.length === 0 || !onDeleteMany) return;
    clearSelection();
    await onDeleteMany(items);
  }

  function handleCanvasKeyDown(e: React.KeyboardEvent) {
    // Never hijack the rename / inline-create inputs that live inside the view.
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
    if (mod && key === "c" && onCopy) {
      e.preventDefault();
      onCopy({ type: "copy", items: getSelectedItems().map((i) => ({ itemType: i.type, id: i.id })) });
      return;
    }
    if (mod && key === "x" && onCut) {
      e.preventDefault();
      onCut({ type: "cut", items: getSelectedItems().map((i) => ({ itemType: i.type, id: i.id })) });
      return;
    }
    if (mod && key === "v" && onPaste) {
      e.preventDefault();
      void onPaste(pasteTargetFolderId());
      return;
    }
    if (e.key === "Escape") clearSelection();
  }

  const isEmpty = childFolders.length === 0 && folderSnippets.length === 0;
  const folderTitle = isRootSpace ? copy.aside.mySpace : (currentFolder?.name ?? copy.aside.mySpace);

  const metaParts = [
    childFolders.length > 0 ? copy.folderView.folderCount(childFolders.length) : null,
    folderSnippets.length > 0 ? copy.folderView.snippetCount(folderSnippets.length) : null,
  ];

  const path = isRootSpace ? [] : getFolderPath(folderId, folders);

  const breadcrumbItems: BreadcrumbItem[] = isRootSpace
    ? [
        {
          id: "space",
          label: copy.aside.mySpace,
          icon: <Layers size={12} aria-hidden="true" />,
        },
      ]
    : [
        {
          id: "space",
          label: copy.aside.mySpace,
          icon: <Layers size={12} aria-hidden="true" />,
          onClick: onNavigateHome,
        },
        ...path.slice(0, -1).map<BreadcrumbItem>((f) => ({
          id: f.id,
          label: f.name,
          icon: <Folder size={12} aria-hidden="true" />,
          onClick: () => onNavigateFolder(f.id),
        })),
        {
          id: path[path.length - 1].id,
          label: path[path.length - 1].name,
          icon: <Folder size={12} aria-hidden="true" />,
        },
      ];

  const hasPaste = !!clipboard;
  const canCreate = !!onCreateFolder || !!onOpenCreateModal;

  // Right-click on the empty canvas (cards stop propagation) opens a quick menu
  // mirroring the header actions: create here or paste into this folder.
  const contextGroups: ContextMenuGroup[] = [
    {
      items: [
        ...(onCreateFolder
          ? [{ id: "new-folder", label: copy.contextMenu.newFolder, Icon: FolderPlus, onClick: () => setCreating("folder") }]
          : []),
        ...(onOpenCreateModal
          ? [{ id: "new-snippet", label: copy.contextMenu.newSnippet, Icon: FilePlus, onClick: () => onOpenCreateModal(parentKey) }]
          : []),
      ],
    },
    ...(onPaste && hasPaste
      ? [{ items: [{ id: "paste", label: copy.contextMenu.paste, Icon: Clipboard, onClick: () => void onPaste(parentKey) }] }]
      : []),
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 overflow-y-auto focus:outline-none"
      onKeyDown={handleCanvasKeyDown}
      onClick={(e) => {
        // Clicking empty canvas (anywhere outside a card) clears the selection.
        if (selectedIds.size > 0 && !(e.target as HTMLElement).closest("[data-selectable-id]")) {
          clearSelection();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = canDropOnCurrentFolder ? "move" : "none"; }}
      onDragEnter={(e) => { e.preventDefault(); drag.enterDropTarget(dropTargetSentinel); }}
      onDrop={(e) => { e.preventDefault(); drag.dropOnFolder(parentKey); }}
      onContextMenu={canCreate || (onPaste && hasPaste)
        ? (e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }
        : undefined}
    >
      <Breadcrumbs items={breadcrumbItems} leading={menuButton} />

      <div
        ref={selectionContainerRef}
        className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-8 pt-6 sm:gap-10 sm:px-6"
      >
        {/* ── Folder header ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <ViewHeader
            icon={
              isRootSpace ? (
                <Layers size={20} className="text-ink/40" />
              ) : (
                <FolderOpen size={20} className="text-ink/40" />
              )
            }
            title={folderTitle}
            metaParts={metaParts}
            actions={
              canCreate ? (
                <>
                  {onCreateFolder && (
                    <button
                      type="button"
                      onClick={() => setCreating("folder")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/[0.08] bg-ink/[0.03] px-3 py-1.5 text-[13px] font-medium text-ink/60 transition-colors hover:border-ink/15 hover:bg-ink/[0.06] hover:text-ink/90 sm:flex-initial"
                    >
                      <FolderPlus size={14} className="opacity-70" />
                      {copy.forms.folderTitle}
                    </button>
                  )}
                  {onOpenCreateModal && (
                    <button
                      type="button"
                      onClick={() => onOpenCreateModal(parentKey)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-ink/[0.08] px-3 py-1.5 text-[13px] font-medium text-ink/80 transition-colors hover:border-ink/25 hover:bg-ink/[0.12] hover:text-ink sm:flex-initial"
                    >
                      <FilePlus size={14} className="opacity-80" />
                      {copy.forms.snippetTitle}
                    </button>
                  )}
                </>
              ) : undefined
            }
          />

          {/* ── Inline create input ────────────────────────────────────────── */}
          {creating && (
            <InlineCreate
              copy={copy}
              onCancel={() => setCreating(null)}
              onCommit={(value) => {
                setCreating(null);
                void onCreateFolder?.(parentKey, value);
              }}
            />
          )}

          {/* ── Drop-to-current-folder indicator ───────────────────────────────── */}
          {showDropHint && (
            <div className={[
              "flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11px] select-none transition-colors duration-100",
              isCurrentFolderDropTarget
                ? "border-ink/35 bg-ink/[0.05] text-ink/60"
                : "border-ink/[0.1] bg-transparent text-faint",
            ].join(" ")}>
              {isRootSpace ? <Layers size={11} /> : <FolderOpen size={11} />}
              {folderTitle}
            </div>
          )}
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {isEmpty && !creating && (
          <EmptyState
            icon={<FileCode2 size={22} className="text-ink/20" />}
            message={copy.folderView.empty}
          />
        )}

        {/* ── Sub-folders ────────────────────────────────────────────────── */}
        {childFolders.length > 0 && (
          <CardSection title={copy.folderView.subFolders} variant="folders">
            {childFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                snippetCount={snippetCountMap.get(folder.id) ?? 0}
                subFolderCount={subFolderCountMap.get(folder.id) ?? 0}
                copy={copy}
                selected={isItemSelected(folder.id)}
                dragItems={isBatchSelected(folder.id) ? getSelectedItems() : undefined}
                onMenuOpen={() => selectForMenu(folder.id)}
                onClick={(e) => activateItem(e, { id: folder.id, type: "folder" })}
                onOpenInNewTab={() => openItemInNewTab("folder", folder.id)}
                onPinAside={onPinFolder ? (pinned) => void onPinFolder(folder.id, "aside", pinned) : undefined}
                onRename={onRenameFolder ? (name) => void onRenameFolder(folder.id, name) : undefined}
                onDelete={
                  onDeleteFolder
                    ? () => {
                        if (isBatchSelected(folder.id) && onDeleteMany) void handleBatchDelete();
                        else void onDeleteFolder(folder.id);
                      }
                    : undefined
                }
                onCut={onCut ? () => onCut(clipboardEntryFor("cut", { id: folder.id, type: "folder" })) : undefined}
                onCopy={onCopy ? () => onCopy(clipboardEntryFor("copy", { id: folder.id, type: "folder" })) : undefined}
                onPaste={onPaste ? () => void onPaste(folder.id) : undefined}
                hasPaste={hasPaste}
              />
            ))}
          </CardSection>
        )}

        {/* ── Snippets grid ──────────────────────────────────────────────── */}
        {folderSnippets.length > 0 && (
          <CardSection title={copy.folderView.snippets} variant="snippets">
            {folderSnippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                folderName={null}
                copy={copy}
                enableDrag
                selected={isItemSelected(snippet.id)}
                dragItems={isBatchSelected(snippet.id) ? getSelectedItems() : undefined}
                onMenuOpen={() => selectForMenu(snippet.id)}
                onSelect={(e) => activateItem(e, { id: snippet.id, type: "snippet" })}
                onOpenInNewTab={() => openItemInNewTab("snippet", snippet.id)}
                onUnpinAside={onPinSnippet ? () => void onPinSnippet(snippet.id, "aside", false) : undefined}
                onPinAside={onPinSnippet ? (pinned) => void onPinSnippet(snippet.id, "aside", pinned) : undefined}
                onPinHome={onPinSnippet ? (pinned) => void onPinSnippet(snippet.id, "home", pinned) : undefined}
                onRename={onRenameSnippet ? (title) => void onRenameSnippet(snippet.id, title) : undefined}
                onDelete={
                  onDeleteSnippet
                    ? () => {
                        if (isBatchSelected(snippet.id) && onDeleteMany) void handleBatchDelete();
                        else void onDeleteSnippet(snippet.id);
                      }
                    : undefined
                }
                onCut={onCut ? () => onCut(clipboardEntryFor("cut", { id: snippet.id, type: "snippet" })) : undefined}
                onCopy={onCopy ? () => onCopy(clipboardEntryFor("copy", { id: snippet.id, type: "snippet" })) : undefined}
                onPaste={onPaste ? () => void onPaste(snippet.folderId) : undefined}
                hasPaste={hasPaste}
                className="w-full shrink"
              />
            ))}
          </CardSection>
        )}

      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          groups={contextGroups}
          onClose={() => setMenu(null)}
        />
      )}
    </main>
  );
}

/* ─────────────────────────── InlineCreate ────────────────────────────────── */

function InlineCreate({
  copy,
  onCommit,
  onCancel,
}: {
  copy: Dictionary;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-ink/[0.08] bg-ink/[0.03] px-3 py-2">
      <Folder size={15} className="shrink-0 text-ink/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={copy.forms.folderName}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-faint outline-none"
      />
    </div>
  );
}
