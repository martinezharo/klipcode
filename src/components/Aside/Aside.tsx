"use client";

import { useState, useEffect } from "react";
import {
  ChevronsLeft,
  Menu,
  Home,
  Layers,
  Plus,
  FolderPlus,
  ChevronRight,
  FileCode2,
  Folder,
  Pin,
  MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/ui/Logo";
import type { FolderRecord, SnippetRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { LANGUAGES } from "@/lib/constants/languages";

interface AsideProps {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  onSelectSnippet: (snippetId: string) => void;
}

// Indent step per depth level in px
const STEP = 14;

function sortByPinThenAlpha<T extends { isPinned: boolean }>(
  items: T[],
  key: (item: T) => string
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return key(a).localeCompare(key(b));
  });
}

// The action icons that appear on hover, to the LEFT of the pin icon
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

function FolderNode({
  folder,
  folders,
  snippets,
  depth,
  copy,
}: {
  folder: FolderRecord;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  depth: number;
  copy: Dictionary;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const childFolders = sortByPinThenAlpha(
    folders.filter((f) => f.parentId === folder.id),
    (f) => f.name
  );
  const childSnippets = sortByPinThenAlpha(
    snippets.filter((s) => s.folderId === folder.id),
    (s) => s.title ?? ""
  );
  const hasChildren = childFolders.length > 0 || childSnippets.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
        style={{ paddingLeft: `${10 + depth * STEP}px` }}
      >
        <ChevronRight
          size={13}
          className={`shrink-0 text-white/25 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
        />
        <Folder size={13} className="shrink-0 text-white/25" />
        <span className="flex-1 truncate leading-none">{folder.name}</span>
        <ItemActions
          showAdd
          onAdd={(e) => e.stopPropagation()}
          onMore={(e) => e.stopPropagation()}
        />
        {folder.isPinned && (
          <Pin size={10} className="shrink-0 text-white/30" />
        )}
      </button>

      {isOpen && hasChildren && (
        <div className="relative">
          {/* Vertical guide line aligned to chevron center */}
          <div
            className="absolute top-0 bottom-1 w-px bg-white/[0.05]"
            style={{ left: `${10 + depth * STEP + 6}px` }}
          />
          {childFolders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              snippets={snippets}
              depth={depth + 1}
              copy={copy}
            />
          ))}
          {childSnippets.map((snippet) => (
            <SnippetNode key={snippet.id} snippet={snippet} depth={depth + 1} copy={copy} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnippetNode({
  snippet,
  depth,
  copy,
}: {
  snippet: SnippetRecord;
  depth: number;
  copy: Dictionary;
}) {
  const ext = LANGUAGES.find((l) => l.id === snippet.language)?.extension || "";
  const baseName = snippet.title || copy.snippetCard.untitled;
  const displayName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
      // Align with folder text: skip chevron area (13px) + gap (6px)
      style={{ paddingLeft: `${10 + depth * STEP + 19}px` }}
    >
      <FileCode2 size={13} className="shrink-0 text-white/20" />
      <span className="flex-1 truncate leading-none">{displayName}</span>
      <ItemActions onMore={(e) => e.stopPropagation()} />
      {snippet.isPinned && (
        <Pin size={10} className="shrink-0 text-white/30" />
      )}
    </button>
  );
}

const MOBILE_BP = 1024; // matches Tailwind `lg`

export function Aside({ folders, snippets, copy }: AsideProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

  const rootFolders = folders.filter((f) => f.parentId === null);
  const rootSnippets = snippets.filter((s) => s.folderId === null);

  // Order: pinned folders → pinned snippets → unpinned folders → unpinned snippets
  const pinnedFolders    = sortByPinThenAlpha(rootFolders.filter((f) => f.isPinned),   (f) => f.name);
  const pinnedSnippets   = sortByPinThenAlpha(rootSnippets.filter((s) => s.isPinned),  (s) => s.title ?? "");
  const unpinnedFolders  = sortByPinThenAlpha(rootFolders.filter((f) => !f.isPinned),  (f) => f.name);
  const unpinnedSnippets = sortByPinThenAlpha(rootSnippets.filter((s) => !s.isPinned), (s) => s.title ?? "");

  const isEmpty = rootFolders.length === 0 && rootSnippets.length === 0;

  return (
    <>
      {/* ── Hamburger — visible when aside is closed ── */}
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

      {/* ── Mobile backdrop ── */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Aside panel ── */}
      {isOpen && (
        <aside
          className={`flex h-screen w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-background${isMobile ? " fixed inset-y-0 left-0 z-50" : ""}`}
        >
          {/* ── Logo + Collapse ─────────────────────── */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5 text-foreground" />
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                KodeBoard
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

          {/* ── Home ────────────────────────────────── */}
          <div className="px-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
            >
              <Home size={14} className="shrink-0" />
              <span>{copy.aside.home}</span>
            </button>
          </div>

          <div className="mx-4 my-3 border-t border-white/[0.05]" />

          {/* ── My Space ────────────────────────────── */}
          <div className="flex flex-1 flex-col overflow-hidden px-2">
            {/* Section header */}
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5">
                <Layers size={12} className="text-white/25" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                  {copy.aside.mySpace}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title={copy.aside.addSnippet}
                  className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  title={copy.aside.addFolder}
                  className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
                >
                  <FolderPlus size={13} />
                </button>
              </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto pb-4">
              {isEmpty ? (
                <p className="px-3 pt-1 text-xs text-white/20">
                  {copy.aside.emptySpace}
                </p>
              ) : (
                <div>
                  {pinnedFolders.map((folder) => (
                    <FolderNode
                      key={folder.id}
                      folder={folder}
                      folders={folders}
                      snippets={snippets}
                      depth={0}
                      copy={copy}
                    />
                  ))}
                  {pinnedSnippets.map((snippet) => (
                    <SnippetNode key={snippet.id} snippet={snippet} depth={0} copy={copy} />
                  ))}
                  {unpinnedFolders.map((folder) => (
                    <FolderNode
                      key={folder.id}
                      folder={folder}
                      folders={folders}
                      snippets={snippets}
                      depth={0}
                      copy={copy}
                    />
                  ))}
                  {unpinnedSnippets.map((snippet) => (
                    <SnippetNode key={snippet.id} snippet={snippet} depth={0} copy={copy} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
