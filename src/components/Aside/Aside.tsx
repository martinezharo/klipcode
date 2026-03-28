"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsLeft,
  Clipboard,
  Copy,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  Layers,
  Menu,
  MoreHorizontal,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";

import { Logo } from "@/ui/Logo";
import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import type { ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import type { FolderRecord, SnippetRecord, ClipboardEntry } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { LANGUAGES } from "@/lib/constants/languages";
import { SPACE_ROOT_ID } from "@/lib/navigation";

/* ─────────────────────────── Props ─────────────────────────────────────── */

export interface AsideProps {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  clipboard: ClipboardEntry | null;
  onSelectSnippet: (snippetId: string) => void;
  onGoHome: () => void;
  onGoSpace: () => void;
  onNewSnippetAt: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRenameSnippet: (id: string, title: string) => Promise<void>;
  onPinFolder: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinSnippet: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onCut: (entry: ClipboardEntry) => void;
  onCopy: (entry: ClipboardEntry) => void;
  onPaste: (targetFolderId: string | null) => Promise<void>;
  onMoveFolder: (id: string, newParentId: string | null) => Promise<void>;
  onMoveSnippet: (id: string, newFolderId: string | null) => Promise<void>;
  onSelectFolder?: (folderId: string) => void;
}

/* ─────────────────────────── Internal context ───────────────────────────── */

interface MenuTarget {
  type: "folder" | "snippet" | "root";
  id?: string;
  x: number;
  y: number;
}

interface AsideCtxShape {
  copy: Dictionary;
  renamingId: string | null;
  /** undefined = inactive, null = creating at root, string = inside that folder id */
  creatingFolderParentId: string | null | undefined;
  openMenu: (target: MenuTarget) => void;
  beginRename: (id: string) => void;
  submitFolderRename: (id: string, value: string) => void;
  submitSnippetRename: (id: string, value: string) => void;
  cancelRename: () => void;
  beginCreateFolder: (parentId: string | null) => void;
  cancelCreateFolder: () => void;
  submitCreateFolder: (parentId: string | null, name: string) => void;
  selectSnippet: (id: string) => void;
  selectFolder: (id: string) => void;
  /* ── Drag & Drop ── */
  dragging: { type: "folder" | "snippet"; id: string } | null;
  dragOverId: string | "root" | null;
  startDrag: (type: "folder" | "snippet", id: string) => void;
  endDrag: () => void;
  enterDropTarget: (id: string | "root") => void;
  dropOnTarget: (targetFolderId: string | null) => void;
  canDropOnFolder: (folderId: string) => boolean;
  folders: FolderRecord[];
}

const AsideCtx = createContext<AsideCtxShape>(null!);

/* ─────────────────────────── Constants ─────────────────────────────────── */

const STEP = 14;
const MOBILE_BP = 1024;

/* ─────────────────────────── Utilities ─────────────────────────────────── */

function sortByPinThenAlpha<T extends { isPinnedAside: boolean }>(
  items: T[],
  key: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
    return key(a).localeCompare(key(b));
  });
}

/** Returns true if `targetId` is `ancestorId` itself or a descendant of it. */
function isDescendantOrSelf(
  folders: FolderRecord[],
  ancestorId: string,
  targetId: string,
): boolean {
  if (targetId === ancestorId) return true;
  let current = folders.find((f) => f.id === targetId);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = folders.find((f) => f.id === current!.parentId);
  }
  return false;
}

/* ─────────────────────────── NewFolderInput ─────────────────────────────── */

function NewFolderInput({ depth, parentId }: { depth: number; parentId: string | null }) {
  const { cancelCreateFolder, submitCreateFolder, copy } = useContext(AsideCtx);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commit() {
    const name = value.trim();
    if (name) submitCreateFolder(parentId, name);
    else cancelCreateFolder();
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[5px] pr-2"
      style={{ paddingLeft: `${10 + depth * STEP}px` }}
    >
      <span className="w-[13px] shrink-0" />
      <Folder size={13} className="shrink-0 text-white/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancelCreateFolder();
        }}
        placeholder={copy.forms.folderName}
        className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground placeholder:text-white/20 outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
      />
    </div>
  );
}

/* ─────────────────────────── ItemActions ────────────────────────────────── */

function ItemActions({
  showAdd,
  onAdd,
  onMore,
}: {
  showAdd?: boolean;
  onAdd?: (e: React.MouseEvent) => void;
  onMore?: (e: React.MouseEvent) => void;
}) {
  return (
    <span className="invisible flex shrink-0 items-center gap-px group-hover:visible">
      {showAdd && (
        <span
          role="button"
          className="rounded p-0.5 text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/70"
          onClick={onAdd}
        >
          <Plus size={12} />
        </span>
      )}
      <span
        role="button"
        className="rounded p-0.5 text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/70"
        onClick={onMore}
      >
        <MoreHorizontal size={12} />
      </span>
    </span>
  );
}

/* ─────────────────────────── FolderNode ─────────────────────────────────── */

function FolderNode({
  folder,
  folders,
  snippets,
  depth,
}: {
  folder: FolderRecord;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  depth: number;
}) {
  const ctx = useContext(AsideCtx);
  const [isOpen, setIsOpen] = useState(false);

  const isRenaming = ctx.renamingId === folder.id;
  const isCreatingHere = ctx.creatingFolderParentId === folder.id;

  const childFolders = sortByPinThenAlpha(
    folders.filter((f) => f.parentId === folder.id),
    (f) => f.name,
  );
  const childSnippets = sortByPinThenAlpha(
    snippets.filter((s) => s.folderId === folder.id),
    (s) => s.title ?? "",
  );

  const prevCreating = useRef(false);
  useEffect(() => {
    if (isCreatingHere && !prevCreating.current) setIsOpen(true);
    prevCreating.current = isCreatingHere;
  }, [isCreatingHere]);

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.openMenu({ type: "folder", id: folder.id, x: e.clientX, y: e.clientY });
  }

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "folder", id: folder.id, x: rect.left, y: rect.bottom + 4 });
  }

  const paddingLeft = 10 + depth * STEP;
  const isDraggingThis = ctx.dragging?.id === folder.id;
  const isDropTarget = ctx.dragOverId === folder.id && ctx.canDropOnFolder(folder.id);
  const sharedRowClass = [
    "group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-all duration-100 hover:bg-white/[0.04] hover:text-foreground",
    isDraggingThis ? "opacity-40" : "",
    isDropTarget ? "bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/[0.18]" : "",
  ].filter(Boolean).join(" ");
  const hasChildren = childFolders.length > 0 || childSnippets.length > 0;

  return (
    <div>
      {isRenaming ? (
        <div
          className={sharedRowClass}
          style={{ paddingLeft }}
          onContextMenu={openContextMenu}
        >
          <ChevronRight
            size={13}
            className={`shrink-0 text-white/25 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
          {isOpen && hasChildren ? (
            <FolderOpen size={13} className="shrink-0 text-white/25" />
          ) : (
            <Folder size={13} className="shrink-0 text-white/25" />
          )}
          <input
            autoFocus
            defaultValue={folder.name}
            onBlur={(e) => ctx.submitFolderRename(folder.id, e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter")
                ctx.submitFolderRename(folder.id, (e.target as HTMLInputElement).value);
              if (e.key === "Escape") ctx.cancelRename();
            }}
            className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
          />
        </div>
      ) : (
        <div
          className={sharedRowClass}
          style={{ paddingLeft }}
          role="button"
          tabIndex={0}
          onClick={() => ctx.selectFolder(folder.id)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ctx.selectFolder(folder.id);
            }
          }}
          onContextMenu={openContextMenu}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.enterDropTarget(folder.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = ctx.canDropOnFolder(folder.id) ? "move" : "none";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.dropOnTarget(folder.id);
          }}
        >
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center text-white/25 transition-colors hover:text-white/45"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((value) => !value);
            }}
            title={ctx.copy.aside.toggleFolder}
            aria-label={ctx.copy.aside.toggleFolder}
          >
            <ChevronRight
              size={13}
              className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            />
          </button>

          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              ctx.startDrag("folder", folder.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => ctx.endDrag()}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            {isOpen && hasChildren ? (
              <FolderOpen size={13} className="shrink-0 text-white/25" />
            ) : (
              <Folder size={13} className="shrink-0 text-white/25" />
            )}
            <span className="flex-1 truncate leading-none">{folder.name}</span>
          </button>

          <ItemActions
            showAdd
            onAdd={(e) => {
              e.stopPropagation();
              setIsOpen(true);
              ctx.beginCreateFolder(folder.id);
            }}
            onMore={openMoreMenu}
          />
          {folder.isPinnedAside && (
            <Pin size={10} className="shrink-0 text-white/30" />
          )}
        </div>
      )}

      {(isOpen || isCreatingHere) && (
        <div className="relative">
          {(hasChildren || isCreatingHere) && (
            <div
              className="absolute bottom-1 top-0 w-px bg-white/[0.05]"
              style={{ left: `${paddingLeft + 6}px` }}
            />
          )}
          {isCreatingHere && (
            <NewFolderInput depth={depth + 1} parentId={folder.id} />
          )}
          {childFolders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              snippets={snippets}
              depth={depth + 1}
            />
          ))}
          {childSnippets.map((snippet) => (
            <SnippetNode key={snippet.id} snippet={snippet} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── SnippetNode ────────────────────────────────── */

function SnippetNode({ snippet, depth }: { snippet: SnippetRecord; depth: number }) {
  const ctx = useContext(AsideCtx);
  const isRenaming = ctx.renamingId === snippet.id;

  const ext = LANGUAGES.find((l) => l.id === snippet.language)?.extension ?? "";
  const baseName = snippet.title || ctx.copy.snippetCard.untitled;
  const displayName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;

  const paddingLeft = 10 + depth * STEP + 19;
  const isDraggingThis = ctx.dragging?.id === snippet.id;
  const sharedRowClass = [
    "group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-all duration-100 hover:bg-white/[0.04] hover:text-foreground",
    isDraggingThis ? "opacity-40" : "",
  ].filter(Boolean).join(" ");

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.openMenu({ type: "snippet", id: snippet.id, x: e.clientX, y: e.clientY });
  }

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "snippet", id: snippet.id, x: rect.left, y: rect.bottom + 4 });
  }

  return isRenaming ? (
    <div
      className={sharedRowClass}
      style={{ paddingLeft }}
      onContextMenu={openContextMenu}
    >
      <FileCode2 size={13} className="shrink-0 text-white/20" />
      <input
        autoFocus
        defaultValue={snippet.title ?? ""}
        onBlur={(e) => ctx.submitSnippetRename(snippet.id, e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter")
            ctx.submitSnippetRename(snippet.id, (e.target as HTMLInputElement).value);
          if (e.key === "Escape") ctx.cancelRename();
        }}
        className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
      />
    </div>
  ) : (
    <button
      type="button"
      draggable
      onClick={() => ctx.selectSnippet(snippet.id)}
      onContextMenu={openContextMenu}
      onDragStart={(e) => {
        e.stopPropagation();
        ctx.startDrag("snippet", snippet.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => ctx.endDrag()}
      className={sharedRowClass}
      style={{ paddingLeft }}
    >
      <FileCode2 size={13} className="shrink-0 text-white/20" />
      <span className="flex-1 truncate leading-none">{displayName}</span>
      <ItemActions onMore={openMoreMenu} />
      {snippet.isPinnedAside && (
        <Pin size={10} className="shrink-0 text-white/30" />
      )}
    </button>
  );
}

/* ─────────────────────────── Aside ──────────────────────────────────────── */

export function Aside({
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
}: AsideProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    string | null | undefined
  >(undefined);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [dragging, setDragging] = useState<{ type: "folder" | "snippet"; id: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | "root" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      if (matches) setIsOpen(false);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Menu groups builder ───────────────────────────────────────────────── */

  const buildMenuGroups = useCallback(
    (target: MenuTarget): ContextMenuGroup[] => {
      const { type, id } = target;
      const cm = copy.contextMenu;

      if (type === "root") {
        return [
          {
            items: [
              {
                id: "new-folder",
                label: cm.newFolder,
                Icon: FolderPlus,
                onClick: () => setCreatingFolderParentId(null),
              },
              {
                id: "new-snippet",
                label: cm.newSnippet,
                Icon: FilePlus,
                onClick: () => { onGoHome(); onNewSnippetAt(null); },
              },
            ],
          },
          ...(clipboard
            ? [{
                items: [{
                  id: "paste",
                  label: cm.paste,
                  Icon: Clipboard,
                  onClick: () => void onPaste(null),
                }],
              }]
            : []),
        ];
      }

      if (type === "folder" && id) {
        const folder = folders.find((f) => f.id === id);
        if (!folder) return [];
        return [
          {
            items: [
              {
                id: "new-folder",
                label: cm.newFolder,
                Icon: FolderPlus,
                onClick: () => setCreatingFolderParentId(id),
              },
              {
                id: "new-snippet",
                label: cm.newSnippet,
                Icon: FilePlus,
                onClick: () => { onGoHome(); onNewSnippetAt(id); },
              },
            ],
          },
          {
            items: [
              folder.isPinnedAside
                ? { id: "unpin", label: cm.unpin, Icon: PinOff, onClick: () => void onPinFolder(id, "aside", false) }
                : { id: "pin",   label: cm.pin,   Icon: Pin,    onClick: () => void onPinFolder(id, "aside", true)  },
              {
                id: "rename",
                label: cm.rename,
                Icon: PenLine,
                onClick: () => setRenamingId(id),
              },
            ],
          },
          {
            items: [
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  itemType: "folder", id }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", itemType: "folder", id }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(id) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: () => void onDeleteFolder(id),
            }],
          },
        ];
      }

      if (type === "snippet" && id) {
        const snippet = snippets.find((s) => s.id === id);
        if (!snippet) return [];
        return [
          {
            items: [{
              id: "copy-content",
              label: cm.copyContent,
              Icon: Copy,
              onClick: () => void navigator.clipboard.writeText(snippet.code ?? ""),
            }],
          },
          {
            items: [
              snippet.isPinnedAside
                ? { id: "unpin-aside", label: cm.unpinAside, Icon: PinOff, onClick: () => void onPinSnippet(id, "aside", false) }
                : { id: "pin-aside",   label: cm.pinAside,   Icon: Pin,    onClick: () => void onPinSnippet(id, "aside", true)  },
              snippet.isPinnedHome
                ? { id: "unpin-home", label: cm.unpinHome, Icon: PinOff, onClick: () => void onPinSnippet(id, "home", false) }
                : { id: "pin-home",   label: cm.pinHome,   Icon: Pin,    onClick: () => void onPinSnippet(id, "home", true)  },
              {
                id: "rename",
                label: cm.rename,
                Icon: PenLine,
                onClick: () => setRenamingId(id),
              },
            ],
          },
          {
            items: [
              { id: "cut",  label: cm.cut,  Icon: Scissors, onClick: () => onCut({ type: "cut",  itemType: "snippet", id }) },
              { id: "copy", label: cm.copy, Icon: Copy,     onClick: () => onCopy({ type: "copy", itemType: "snippet", id }) },
              ...(clipboard ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => void onPaste(snippet.folderId) }] : []),
            ],
          },
          {
            items: [{
              id: "delete",
              label: cm.delete,
              Icon: Trash2,
              variant: "destructive" as const,
              onClick: () => void onDeleteSnippet(id),
            }],
          },
        ];
      }

      return [];
    },
    [clipboard, copy.contextMenu, folders, snippets, onGoHome, onNewSnippetAt, onPaste, onPinFolder, onPinSnippet, onDeleteFolder, onDeleteSnippet, onCut, onCopy],
  );

  /* ── AsideCtx value ────────────────────────────────────────────────────── */

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
    /* DnD */
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

      {!isOpen && (
        <button
          type="button"
          title={copy.aside.open}
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-50 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-muted"
        >
          <Menu size={16} />
        </button>
      )}

      {isOpen && isMobile && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} />
      )}

      {isOpen && (
        <aside
          className={`flex h-screen w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-surface${
            isMobile ? " fixed inset-y-0 left-0 z-50" : ""
          }`}
        >
          {/* Logo + Collapse */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5 text-foreground" />
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                {copy.app.title}
              </span>
            </div>
            <button
              type="button"
              title={copy.aside.collapse}
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
            >
              <ChevronsLeft size={15} />
            </button>
          </div>

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
                  <Plus size={13} />
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

              {/* Root drop zone — visible only while dragging */}
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
      )}
    </AsideCtx.Provider>
  );
}
