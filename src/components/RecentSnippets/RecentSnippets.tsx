"use client";

import { Clock, Folder, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Editor } from "@/components/Editor/Editor";
import type { SnippetRecord, FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { LANGUAGES } from "@/lib/constants/languages";

interface RecentSnippetsProps {
  snippets: SnippetRecord[];
  folders: FolderRecord[];
  copy: Dictionary;
}

function getFolderName(folderId: string | null, folders: FolderRecord[]): string | null {
  if (!folderId) return null;
  return folders.find((f) => f.id === folderId)?.name ?? null;
}

function SnippetPreviewCard({
  snippet,
  folderName,
  copy,
}: {
  snippet: SnippetRecord;
  folderName: string | null;
  copy: Dictionary;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ext = LANGUAGES.find((l) => l.id === snippet.language)?.extension || "";
  const baseName = snippet.title || copy.snippetCard.untitled;
  const displayName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface transition-colors hover:border-white/[0.12] hover:bg-surface-hover">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="truncate text-sm font-medium text-foreground">
              {displayName}
            </h3>
            {folderName && (
              <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted">
                <Folder size={12} />
                <span className="truncate max-w-[100px]">{folderName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-white/[0.08] hover:text-foreground"
            title="Copiar"
            aria-label="Copiar snippet"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Code preview */}
      <div className="relative overflow-hidden px-1 pb-1">
        <div className="max-h-[140px] overflow-hidden rounded-lg [&_.cm-scroller]:!overflow-hidden">
          <Editor
            value={snippet.code}
            language={snippet.language}
            readOnly
            height="140px"
            fontSize={12}
          />
        </div>
        <div className="pointer-events-none absolute bottom-1 left-1 right-1 h-12 bg-gradient-to-t from-surface group-hover:from-surface-hover to-transparent rounded-b-lg" />
      </div>
    </article>
  );
}

export function RecentSnippets({ snippets, folders, copy }: RecentSnippetsProps) {
  const recentSnippets = [...snippets]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Clock size={16} className="text-muted" />
        <h2 className="text-sm font-medium text-muted">
          {copy.recentSnippets.title}
        </h2>
      </div>

      {recentSnippets.length === 0 ? (
        <p className="text-sm text-white/30">{copy.recentSnippets.empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recentSnippets.map((snippet) => (
            <SnippetPreviewCard
              key={snippet.id}
              snippet={snippet}
              folderName={getFolderName(snippet.folderId, folders)}
              copy={copy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
