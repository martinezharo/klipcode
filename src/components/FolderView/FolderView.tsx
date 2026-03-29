"use client";

import { useMemo, type ReactNode } from "react";
import { FileCode2, Folder, FolderOpen, Layers } from "lucide-react";

import type { Dictionary } from "@/i18n";
import type { ClipboardEntry, FolderRecord, SnippetRecord } from "@/lib/types";
import { SPACE_ROOT_ID } from "@/lib/navigation";
import { SnippetCard } from "@/components/SnippetCards/SnippetCard";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs/Breadcrumbs";
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
  onCutSnippet?: (id: string) => void;
  onCopySnippet?: (id: string) => void;
  onDeleteFolder?: (id: string) => Promise<void>;
  onRenameFolder?: (id: string, name: string) => Promise<void>;
  onCutFolder?: (id: string) => void;
  onCopyFolder?: (id: string) => void;
  onPaste?: (targetFolderId: string | null) => Promise<void>;
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
  onCutSnippet,
  onCopySnippet,
  onDeleteFolder,
  onRenameFolder,
  onCutFolder,
  onCopyFolder,
  onPaste,
  menuButton,
}: FolderViewProps) {
  const isRootSpace = folderId === SPACE_ROOT_ID;
  const currentFolder = isRootSpace ? null : folders.find((f) => f.id === folderId);
  if (!isRootSpace && !currentFolder) return null;

  const parentKey = isRootSpace ? null : folderId;

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

  return (
    <main className="flex-1 overflow-y-auto">
      <Breadcrumbs items={breadcrumbItems} leading={menuButton} />

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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  snippetCount={snippetCountMap.get(folder.id) ?? 0}
                  subFolderCount={subFolderCountMap.get(folder.id) ?? 0}
                  copy={copy}
                  onClick={() => onNavigateFolder(folder.id)}
                  onPinAside={onPinFolder ? (pinned) => void onPinFolder(folder.id, "aside", pinned) : undefined}
                  onRename={onRenameFolder ? (name) => void onRenameFolder(folder.id, name) : undefined}
                  onDelete={onDeleteFolder ? () => void onDeleteFolder(folder.id) : undefined}
                  onCut={onCutFolder ? () => onCutFolder(folder.id) : undefined}
                  onCopy={onCopyFolder ? () => onCopyFolder(folder.id) : undefined}
                  onPaste={onPaste ? () => void onPaste(folder.id) : undefined}
                  hasPaste={hasPaste}
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
                  onUnpinAside={onPinSnippet ? () => void onPinSnippet(snippet.id, "aside", false) : undefined}
                  onPinAside={onPinSnippet ? (pinned) => void onPinSnippet(snippet.id, "aside", pinned) : undefined}
                  onPinHome={onPinSnippet ? (pinned) => void onPinSnippet(snippet.id, "home", pinned) : undefined}
                  onRename={onRenameSnippet ? (title) => void onRenameSnippet(snippet.id, title) : undefined}
                  onDelete={onDeleteSnippet ? () => void onDeleteSnippet(snippet.id) : undefined}
                  onCut={onCutSnippet ? () => onCutSnippet(snippet.id) : undefined}
                  onCopy={onCopySnippet ? () => onCopySnippet(snippet.id) : undefined}
                  onPaste={onPaste ? () => void onPaste(snippet.folderId) : undefined}
                  hasPaste={hasPaste}
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
