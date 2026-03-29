"use client";

import { Clock, Pin } from "lucide-react";
import type { ReactNode } from "react";
import ScrollContainer from "react-indiana-drag-scroll";

import type { Dictionary } from "@/i18n";
import type { FolderRecord, SnippetRecord } from "@/lib/types";

import { SnippetCard } from "./SnippetCard";

function getFolderName(folderId: string | null, folders: FolderRecord[]): string | null {
  if (!folderId) {
    return null;
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? null;
}

function sortSnippetsByUpdatedAtDesc(snippets: SnippetRecord[]) {
  return [...snippets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

interface SnippetCardsSectionProps {
  title: string;
  icon: ReactNode;
  snippets: SnippetRecord[];
  folders: FolderRecord[];
  copy: Dictionary;
  onSelectSnippet: (snippetId: string) => void;
  onNavigateFolder?: (folderId: string) => void;
  onUnpinHomeSnippet?: (snippetId: string) => void;
  emptyMessage?: string;
}

function SnippetCardsSection({
  title,
  icon,
  snippets,
  folders,
  copy,
  onSelectSnippet,
  onNavigateFolder,
  onUnpinHomeSnippet,
  emptyMessage,
}: SnippetCardsSectionProps) {
  if (snippets.length === 0) {
    if (!emptyMessage) {
      return null;
    }

    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-medium text-muted">{title}</h2>
        </div>

        <p className="text-sm text-white/30">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium text-muted">{title}</h2>
      </div>

      <div className="relative">
        <ScrollContainer
          className="flex gap-3 overflow-x-auto pb-2 pr-20 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          hideScrollbars={false}
        >
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              folderName={getFolderName(snippet.folderId, folders)}
              copy={copy}
              onSelect={() => onSelectSnippet(snippet.id)}
              onNavigateFolder={
                snippet.folderId && onNavigateFolder
                  ? () => onNavigateFolder(snippet.folderId!)
                  : undefined
              }
              onUnpinHome={onUnpinHomeSnippet ? () => onUnpinHomeSnippet(snippet.id) : undefined}
            />
          ))}
        </ScrollContainer>

        <div className="pointer-events-none absolute bottom-2 right-0 top-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}

interface SharedSnippetCardsProps {
  snippets: SnippetRecord[];
  folders: FolderRecord[];
  copy: Dictionary;
  onSelectSnippet: (snippetId: string) => void;
  onNavigateFolder?: (folderId: string) => void;
  onPinSnippet?: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
}

export function PinnedSnippetCards({
  snippets,
  folders,
  copy,
  onSelectSnippet,
  onNavigateFolder,
  onPinSnippet,
}: SharedSnippetCardsProps) {
  const pinnedSnippets = sortSnippetsByUpdatedAtDesc(
    snippets.filter((snippet) => snippet.isPinnedHome)
  );

  return (
    <SnippetCardsSection
      title={copy.pinnedToHome.title}
      icon={<Pin size={16} className="text-muted" />}
      snippets={pinnedSnippets}
      folders={folders}
      copy={copy}
      onSelectSnippet={onSelectSnippet}
      onNavigateFolder={onNavigateFolder}
      onUnpinHomeSnippet={onPinSnippet ? (snippetId) => void onPinSnippet(snippetId, "home", false) : undefined}
    />
  );
}

export function RecentSnippetCards({
  snippets,
  folders,
  copy,
  onSelectSnippet,
  onNavigateFolder,
}: SharedSnippetCardsProps) {
  const recentSnippets = sortSnippetsByUpdatedAtDesc(snippets).slice(0, 6);

  return (
    <SnippetCardsSection
      title={copy.recentSnippets.title}
      icon={<Clock size={16} className="text-muted" />}
      snippets={recentSnippets}
      folders={folders}
      copy={copy}
      onSelectSnippet={onSelectSnippet}
      onNavigateFolder={onNavigateFolder}
      emptyMessage={copy.recentSnippets.empty}
    />
  );
}

interface SnippetCardsProps extends SharedSnippetCardsProps {}

export function SnippetCards(props: SnippetCardsProps) {
  return (
    <div className="flex flex-col gap-8">
      <PinnedSnippetCards {...props} />
      <RecentSnippetCards {...props} />
    </div>
  );
}