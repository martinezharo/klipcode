"use client";

import { Clock, Pin } from "lucide-react";
import type { ReactNode } from "react";

import type { Dictionary } from "@/i18n";
import type { ClipboardEntry, FolderRecord, SnippetRecord } from "@/lib/types";
import { openItemInNewTab } from "@/lib/navigation";

import { SnippetCard } from "./SnippetCard";

function getFolderName(folderId: string | null, folders: FolderRecord[]): string | null {
  if (!folderId) return null;
  return folders.find((f) => f.id === folderId)?.name ?? null;
}

function sortByUpdatedAtDesc(snippets: SnippetRecord[]) {
  return [...snippets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Roving focus across the card grid: arrow keys move DOM focus to the previous/
 * next card (Enter/Space are handled per-card to open). Cards are already
 * `role="button" tabIndex={0}`, so this only needs to relocate focus.
 */
function handleGridArrowNav(e: React.KeyboardEvent<HTMLDivElement>) {
  if (
    e.key !== "ArrowDown" &&
    e.key !== "ArrowUp" &&
    e.key !== "ArrowLeft" &&
    e.key !== "ArrowRight"
  ) {
    return;
  }
  const cards = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("[data-snippet-card]"),
  );
  const current = cards.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;
  e.preventDefault();
  const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
  cards[current + delta]?.focus();
}

export interface SnippetCardsProps {
  snippets: SnippetRecord[];
  folders: FolderRecord[];
  copy: Dictionary;
  clipboard?: ClipboardEntry | null;
  onSelectSnippet: (snippetId: string) => void;
  onNavigateFolder?: (folderId: string) => void;
  onPinSnippet?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onDeleteSnippet?: (id: string) => Promise<void>;
  onRenameSnippet?: (id: string, title: string) => Promise<void>;
  onCutSnippet?: (id: string) => void;
  onCopySnippet?: (id: string) => void;
  onPaste?: (targetFolderId: string | null) => Promise<void>;
}

export function SnippetCards(props: SnippetCardsProps) {
  const { snippets, copy } = props;

  const pinnedSnippets = sortByUpdatedAtDesc(snippets.filter((s) => s.isPinnedHome));
  const recentSnippets = sortByUpdatedAtDesc(snippets).slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      {pinnedSnippets.length > 0 && (
        <SnippetCardsSection
          {...props}
          title={copy.pinnedToHome.title}
          icon={<Pin size={16} className="text-muted" />}
          snippets={pinnedSnippets}
        />
      )}

      <SnippetCardsSection
        {...props}
        title={copy.recentSnippets.title}
        icon={<Clock size={16} className="text-muted" />}
        snippets={recentSnippets}
        emptyMessage={copy.recentSnippets.empty}
      />
    </div>
  );
}

interface SnippetCardsSectionProps extends SnippetCardsProps {
  title: string;
  icon: ReactNode;
  emptyMessage?: string;
}

function SnippetCardsSection({
  title,
  icon,
  snippets,
  folders,
  copy,
  clipboard,
  emptyMessage,
  onSelectSnippet,
  onNavigateFolder,
  onPinSnippet,
  onDeleteSnippet,
  onRenameSnippet,
  onCutSnippet,
  onCopySnippet,
  onPaste,
}: SnippetCardsSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium text-muted">{title}</h2>
      </div>

      {snippets.length === 0 ? (
        emptyMessage ? <p className="text-sm text-faint">{emptyMessage}</p> : null
      ) : (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          onKeyDown={handleGridArrowNav}
        >
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              folderName={getFolderName(snippet.folderId, folders)}
              copy={copy}
              onSelect={() => onSelectSnippet(snippet.id)}
              onOpenInNewTab={() => openItemInNewTab("snippet", snippet.id)}
              onNavigateFolder={
                snippet.folderId && onNavigateFolder
                  ? () => onNavigateFolder(snippet.folderId!)
                  : undefined
              }
              onUnpinHome={
                snippet.isPinnedHome && onPinSnippet
                  ? () => void onPinSnippet(snippet.id, "home", false)
                  : undefined
              }
              onPinAside={
                onPinSnippet
                  ? (pinned) => void onPinSnippet(snippet.id, "aside", pinned)
                  : undefined
              }
              onPinHome={
                onPinSnippet
                  ? (pinned) => void onPinSnippet(snippet.id, "home", pinned)
                  : undefined
              }
              onRename={
                onRenameSnippet
                  ? (title) => void onRenameSnippet(snippet.id, title)
                  : undefined
              }
              onDelete={onDeleteSnippet ? () => void onDeleteSnippet(snippet.id) : undefined}
              onCut={onCutSnippet ? () => onCutSnippet(snippet.id) : undefined}
              onCopy={onCopySnippet ? () => onCopySnippet(snippet.id) : undefined}
              onPaste={onPaste ? () => void onPaste(snippet.folderId) : undefined}
              hasPaste={!!clipboard}
              enableDrag
              className="w-full shrink"
            />
          ))}
        </div>
      )}
    </section>
  );
}