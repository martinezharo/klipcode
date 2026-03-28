"use client";

import { ChevronRight, FileCode2, Folder, FolderOpen, Home } from "lucide-react";

import type { Dictionary } from "@/i18n";
import type { FolderRecord, SnippetRecord } from "@/lib/types";
import { SnippetCard } from "@/components/SnippetCards/SnippetCard";

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
}: {
  folder: FolderRecord;
  snippetCount: number;
  subFolderCount: number;
  copy: Dictionary;
  onClick: () => void;
}) {
  const meta = [
    snippetCount > 0 ? `${snippetCount} ${copy.folderView.snippetLabel}` : null,
    subFolderCount > 0 ? `${subFolderCount} ${copy.folderView.subFolderLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.06] bg-surface px-4 py-3 text-left transition-all duration-100 hover:border-white/[0.12] hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] transition-colors group-hover:bg-white/[0.08]">
        <Folder
          size={14}
          className="text-white/35 transition-colors group-hover:text-white/55"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">
          {folder.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {meta || copy.folderView.emptyFolder}
        </p>
      </div>
    </button>
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
}

export function FolderView({
  folderId,
  folders,
  snippets,
  copy,
  onSelectSnippet,
  onNavigateFolder,
  onNavigateHome,
}: FolderViewProps) {
  const currentFolder = folders.find((f) => f.id === folderId);
  if (!currentFolder) return null;

  const path = getFolderPath(folderId, folders);

  const childFolders = folders
    .filter((f) => f.parentId === folderId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const folderSnippets = snippets
    .filter((s) => s.folderId === folderId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const isEmpty = childFolders.length === 0 && folderSnippets.length === 0;

  const metaParts = [
    childFolders.length > 0
      ? `${childFolders.length} ${copy.folderView.subFolderLabel}`
      : null,
    folderSnippets.length > 0
      ? `${folderSnippets.length} ${copy.folderView.snippetLabel}`
      : null,
  ].filter(Boolean);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8">

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav aria-label={copy.folderView.breadcrumbLabel}>
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            <li>
              <button
                type="button"
                onClick={onNavigateHome}
                className="flex items-center gap-1.5 rounded text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <Home size={13} aria-hidden="true" />
                <span>{copy.aside.home}</span>
              </button>
            </li>

            {path.map((folder, index) => {
              const isLast = index === path.length - 1;
              return (
                <li key={folder.id} className="flex items-center gap-1">
                  <ChevronRight size={13} className="text-white/20" aria-hidden="true" />
                  {isLast ? (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Folder size={13} aria-hidden="true" />
                      {folder.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateFolder(folder.id)}
                      className="flex items-center gap-1.5 rounded text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >
                      <Folder size={13} aria-hidden="true" />
                      {folder.name}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ── Folder header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <FolderOpen size={20} className="text-white/40" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {currentFolder.name}
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
