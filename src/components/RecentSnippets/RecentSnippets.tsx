"use client";

import { Clock } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import type { SnippetRecord, FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";

interface RecentSnippetsProps {
  snippets: SnippetRecord[];
  folders: FolderRecord[];
  copy: Dictionary;
}

function getLanguageExtension(language: string) {
  switch (language) {
    case "javascript":
    case "json":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "html":
    case "xml":
    case "markdown":
      return html();
    case "python":
      return python();
    default:
      return javascript();
  }
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
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface transition-colors hover:border-white/[0.12] hover:bg-surface-hover">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium text-foreground">
            {snippet.title || copy.snippetCard.untitled}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">
              {snippet.language}
            </span>
            {folderName ? (
              <>
                <span className="text-white/20">·</span>
                <span className="truncate">{folderName}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Code preview */}
      <div className="overflow-hidden px-1 pb-1">
        <div className="max-h-[140px] overflow-hidden rounded-lg">
          <CodeMirror
            value={snippet.code}
            theme={vscodeDark}
            extensions={[getLanguageExtension(snippet.language)]}
            editable={false}
            readOnly
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: false,
              bracketMatching: false,
              closeBrackets: false,
              autocompletion: false,
              rectangularSelection: false,
              crosshairCursor: false,
              highlightSelectionMatches: false,
              searchKeymap: false,
            }}
            height="140px"
            style={{ fontSize: "12px", pointerEvents: "none" }}
          />
        </div>
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
