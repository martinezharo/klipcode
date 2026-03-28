"use client";

import { FileCode2, Folder, FolderOpen, Layers, Pin, PinOff } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/utils";

import type { Dictionary } from "@/i18n";
import type { FolderRecord, SnippetRecord } from "@/lib/types";
import { SnippetCard } from "@/components/SnippetCards/SnippetCard";
import { SPACE_ROOT_ID } from "@/lib/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs/Breadcrumbs";

/* ─────────────────────────── Utils ──────────────────────────────────────── */

function getFolderPath(folderId: string, folders: FolderRecord[]): FolderRecord[] {
  const path: FolderRecord[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    const parentId = current.parentId;
    current = parentId ? folders.find((f) => f.id === parentId) : undefined;
  }
  return path;
}

/* ─────────────────────────── FolderCard ─────────────────────────────────── */

function FolderCard({
  folder,
  snippetCount,
  subFolderCount,
  copy,
  onClick,
  onTogglePinAside,
}: {
  folder: FolderRecord;
  snippetCount: number;
  subFolderCount: number;
  copy: Dictionary;
  onClick: () => void;
  onTogglePinAside?: (pinned: boolean) => void;
}) {
  const meta = [
    snippetCount > 0 ? `${snippetCount} ${copy.folderView.snippetLabel}` : null,
    subFolderCount > 0 ? `${subFolderCount} ${copy.folderView.subFolderLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const handleTogglePinAside = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onTogglePinAside?.(!folder.isPinnedAside);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-surface px-4 py-3 text-left transition-all duration-100 hover:border-white/[0.12] hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]">
          <Folder
            size={14}
            className="text-white/35 transition-colors group-hover:text-white/55"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight text-foreground">
            {folder.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {meta || copy.folderView.emptyFolder}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onTogglePinAside && (
          <button
            type="button"
            onClick={handleTogglePinAside}
            className={cn(
              "group/pin relative flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-white/[0.08] hover:text-foreground transition-opacity",
              folder.isPinnedAside ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
            title={folder.isPinnedAside ? copy.contextMenu.unpinAside : copy.contextMenu.pinAside}
            aria-label={folder.isPinnedAside ? copy.contextMenu.unpinAside : copy.contextMenu.pinAside}
          >
            {folder.isPinnedAside ? (
              <>
                <Pin size={14} className="transition-opacity group-hover/pin:opacity-0" />
                <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/pin:opacity-100" />
              </>
            ) : (
              <Pin size={14} />
            )}
          </button>
        )}
      </div>
    </article>
  );
}

/* ─────────────────────────── FolderView ─────────────────────────────────── */

export interface FolderViewProps {
  folderId: string;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  onSelectSnippet: (snippetId: string) => void;
  onNavigateFolder: (folderId: string) => void;
  onNavigateHome: () => void;
  onPinSnippet?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinFolder?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
}

export function FolderView({
  folderId,
  folders,
  snippets,
  copy,
  onSelectSnippet,
  onNavigateFolder,
  onNavigateHome,
  onPinSnippet,
  onPinFolder,
}: FolderViewProps) {
  const isRootSpace = folderId === SPACE_ROOT_ID;
  const currentFolder = isRootSpace ? null : folders.find((f) => f.id === folderId);
  if (!isRootSpace && !currentFolder) return null;

  const path = isRootSpace ? [] : getFolderPath(folderId, folders);

  const childFolders = folders
    .filter((f) => f.parentId === (isRootSpace ? null : folderId))
    .sort((a, b) => {
      if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const folderSnippets = snippets
    .filter((s) => s.folderId === (isRootSpace ? null : folderId))
    .sort((a, b) => {
      if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const isEmpty = childFolders.length === 0 && folderSnippets.length === 0;
  const folderTitle = isRootSpace ? copy.aside.mySpace : (currentFolder?.name ?? copy.aside.mySpace);

  const metaParts = [
    childFolders.length > 0
      ? `${childFolders.length} ${copy.folderView.subFolderLabel}`
      : null,
    folderSnippets.length > 0
      ? `${folderSnippets.length} ${copy.folderView.snippetLabel}`
      : null,
  ].filter(Boolean);

  // ── Build breadcrumb items ──────────────────────────────────────────────────
  const breadcrumbItems: BreadcrumbItem[] = isRootSpace
    ? [
        {
          id: "space",
          label: copy.aside.mySpace,
          icon: <Layers size={12} aria-hidden="true" />,
          // No onClick — this is the current page
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
          // No onClick — current folder, display-only
        },
      ];

  return (
    <main className="flex-1 overflow-y-auto">
      {/* ── Sticky breadcrumb bar ───────────────────────────────────────── */}
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-8 pt-6">
        {/* ── Folder header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            {isRootSpace ? (
              <Layers size={20} className="text-white/40" />
            ) : (
              <FolderOpen size={20} className="text-white/40" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {folderTitle}
            </h1>
            {metaParts.length > 0 && (
              <p className="mt-0.5 text-sm text-muted">{metaParts.join(" · ")}</p>
            )}
          </div>
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.07] py-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
              <FileCode2 size={22} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">{copy.folderView.empty}</p>
          </div>
        )}

        {/* ── Sub-folders ────────────────────────────────────────────────── */}
        {childFolders.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">
              {copy.folderView.subFolders}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  snippetCount={snippets.filter((s) => s.folderId === folder.id).length}
                  subFolderCount={folders.filter((f) => f.parentId === folder.id).length}
                  copy={copy}
                  onClick={() => onNavigateFolder(folder.id)}
                  onTogglePinAside={onPinFolder ? (pinned) => void onPinFolder(folder.id, "aside", pinned) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Snippets grid ──────────────────────────────────────────────── */}
        {folderSnippets.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">
              {copy.folderView.snippets}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {folderSnippets.map((snippet) => (
                <SnippetCard
                  key={snippet.id}
                  snippet={snippet}
                  folderName={null}
                  copy={copy}
                  onSelect={() => onSelectSnippet(snippet.id)}
                  onTogglePinAside={onPinSnippet ? (pinned) => void onPinSnippet(snippet.id, "aside", pinned) : undefined}
                  className="w-full shrink"
                />
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
