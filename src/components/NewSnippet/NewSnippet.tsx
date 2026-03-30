"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Editor } from "@/components/Editor/Editor";
import { LanguageSelect } from "@/ui/LanguageSelect";
import { FolderSelect } from "@/ui/FolderSelect";
import { DEFAULT_LANGUAGE, type LanguageId } from "@/lib/constants/languages";
import type { FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";

interface NewSnippetProps {
  copy: Dictionary;
  folders: FolderRecord[];
  defaultFolderId?: string | null;
  onCreateSnippet: (data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }) => void;
}

export function NewSnippet({ copy, folders, defaultFolderId, onCreateSnippet }: NewSnippetProps) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [code, setCode] = useState("");

  /* Sync pre-selected folder from aside context menu */
  useEffect(() => {
    if (defaultFolderId !== undefined && defaultFolderId !== null) {
      setFolderId(defaultFolderId);
    }
  }, [defaultFolderId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;

    onCreateSnippet({
      title: title.trim(),
      language,
      folderId,
      code,
    });

    setTitle("");
    setLanguage(DEFAULT_LANGUAGE);
    setFolderId(defaultFolderId ?? "");
    setCode("");
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-surface">
      <form onSubmit={handleSubmit}>
        {/* Title + Language row */}
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.forms.snippetTitlePlaceholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-white/30 outline-none"
          />
          <LanguageSelect
            value={language}
            onChange={setLanguage}
            copy={copy.languageSelect}
          />
        </div>

        {/* Editor */}
        <div className="min-h-[200px]">
          <Editor
            value={code}
            onChange={setCode}
            language={language}
            placeholder={copy.forms.snippetCodePlaceholder}
            height="200px"
            fontSize={13}
            gutterBackground="var(--surface)"
          />
        </div>

        {/* Footer: folder selector + create button */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
          <FolderSelect
            value={folderId}
            onChange={setFolderId}
            folders={folders}
            rootLabel={copy.workspace.rootOption}
            copy={copy.folderSelect}
          />

          <button
            type="submit"
            disabled={!code.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>{copy.forms.submitSnippet}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
