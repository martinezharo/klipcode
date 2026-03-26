"use client";

import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { Editor } from "@/components/Editor/Editor";
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageId } from "@/lib/constants/languages";
import type { Dictionary } from "@/i18n";

interface FolderOption {
  value: string;
  label: string;
}

interface NewSnippetProps {
  copy: Dictionary;
  folderOptions: FolderOption[];
  onCreateSnippet: (data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }) => void;
}

export function NewSnippet({ copy, folderOptions, onCreateSnippet }: NewSnippetProps) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [folderId, setFolderId] = useState("");
  const [code, setCode] = useState("");

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
    setLanguage("javascript");
    setFolderId("");
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
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageId)}
              className="rounded-md border border-white/[0.08] bg-background px-2.5 py-1.5 text-xs text-muted outline-none transition-colors hover:border-white/15 hover:text-foreground"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-background px-2.5 py-1.5 text-xs text-muted outline-none transition-colors hover:border-white/15 hover:text-foreground"
            >
              {folderOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
          />
        </div>

        {/* Footer with create button */}
        <div className="flex items-center justify-end border-t border-white/[0.06] px-4 py-2.5">
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
