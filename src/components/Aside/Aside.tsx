"use client";

import { useState } from "react";
import {
  ChevronsLeft,
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

interface AsideProps {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
}

function sortItems<T extends { isPinned: boolean; name?: string; title?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const nameA = ("name" in a ? a.name : (a as unknown as SnippetRecord).title) ?? "";
    const nameB = ("name" in b ? b.name : (b as unknown as SnippetRecord).title) ?? "";
    return nameA.localeCompare(nameB);
  });
}

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
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const childFolders = sortItems(
    folders.filter((f) => f.parentId === folder.id)
  );
  const childSnippets = sortItems(
    snippets.filter((s) => s.folderId === folder.id)
  );

  return (
    <div>
      <button
        type="button"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
        <Folder size={14} className="shrink-0 text-white/20" />
        <span className="flex-1 truncate">{folder.name}</span>
        {folder.isPinned ? (
          <Pin size={10} className="shrink-0 text-white/25" />
        ) : null}
        {isHovered ? (
          <span className="flex shrink-0 items-center gap-0.5">
            <span
              className="rounded p-0.5 transition-colors hover:bg-white/[0.08]"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus size={12} className="text-white/40" />
            </span>
            <span
              className="rounded p-0.5 transition-colors hover:bg-white/[0.08]"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={12} className="text-white/40" />
            </span>
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div>
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
            <SnippetNode
              key={snippet.id}
              snippet={snippet}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SnippetNode({
  snippet,
  depth,
}: {
  snippet: SnippetRecord;
  depth: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
      style={{ paddingLeft: `${8 + depth * 12 + 18}px` }}
    >
      <FileCode2 size={14} className="shrink-0 text-white/20" />
      <span className="flex-1 truncate">{snippet.title || "Untitled"}</span>
      {snippet.isPinned ? (
        <Pin size={10} className="shrink-0 text-white/25" />
      ) : null}
      {isHovered ? (
        <span
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-white/[0.08]"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={12} className="text-white/40" />
        </span>
      ) : null}
    </button>
  );
}

export function Aside({ folders, snippets, copy }: AsideProps) {
  // Root-level: pinned items first, then folders before snippets, alphabetical within same tier
  const rootFolders = folders.filter((f) => f.parentId === null);
  const rootSnippets = snippets.filter((s) => s.folderId === null);

  // Combine pinned items first (sorted alpha), then unpinned folders (alpha), then unpinned snippets (alpha)
  const pinnedFolders = rootFolders.filter((f) => f.isPinned).sort((a, b) => a.name.localeCompare(b.name));
  const pinnedSnippets = rootSnippets.filter((s) => s.isPinned).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  const unpinnedFolders = rootFolders.filter((f) => !f.isPinned).sort((a, b) => a.name.localeCompare(b.name));
  const unpinnedSnippets = rootSnippets.filter((s) => !s.isPinned).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));

  const isEmpty =
    rootFolders.length === 0 && rootSnippets.length === 0;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-background">
      {/* Header: Logo + Collapse */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-foreground" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            KodeBoard
          </span>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
          title={copy.aside.collapse}
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      {/* Home */}
      <div className="px-2 pb-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <Home size={15} />
          <span>{copy.aside.home}</span>
        </button>
      </div>

      <div className="mx-3 my-1 border-t border-white/[0.06]" />

      {/* My Space */}
      <div className="flex flex-1 flex-col overflow-hidden px-2 pt-1">
        <div className="mb-1 flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-white/30" />
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              {copy.aside.mySpace}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
              title={copy.aside.addSnippet}
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              className="rounded p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-muted"
              title={copy.aside.addFolder}
            >
              <FolderPlus size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-3">
          {isEmpty ? (
            <p className="px-2 pt-2 text-xs text-white/25">
              {copy.aside.emptySpace}
            </p>
          ) : (
            <div className="flex flex-col gap-px">
              {/* Pinned snippets first */}
              {pinnedSnippets.map((snippet) => (
                <SnippetNode key={snippet.id} snippet={snippet} depth={0} />
              ))}
              {/* Pinned folders */}
              {pinnedFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  snippets={snippets}
                  depth={0}
                />
              ))}
              {/* Unpinned folders */}
              {unpinnedFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  snippets={snippets}
                  depth={0}
                />
              ))}
              {/* Unpinned snippets */}
              {unpinnedSnippets.map((snippet) => (
                <SnippetNode key={snippet.id} snippet={snippet} depth={0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
