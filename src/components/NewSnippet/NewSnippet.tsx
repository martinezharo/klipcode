"use client";

import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
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

const LANGUAGES = [
  "javascript",
  "typescript",
  "html",
  "css",
  "python",
  "json",
  "markdown",
  "sql",
  "bash",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "yaml",
  "xml",
  "plaintext",
];

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

export function NewSnippet({ copy, folderOptions, onCreateSnippet }: NewSnippetProps) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("javascript");
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
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-background px-2.5 py-1.5 text-xs text-muted outline-none transition-colors hover:border-white/15 hover:text-foreground"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
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

        {/* CodeMirror editor */}
        <div className="min-h-[200px]">
          <CodeMirror
            value={code}
            onChange={setCode}
            theme={vscodeDark}
            extensions={[getLanguageExtension(language)]}
            placeholder={copy.forms.snippetCodePlaceholder}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
              foldGutter: true,
              indentOnInput: true,
              tabSize: 2,
            }}
            height="200px"
            style={{ fontSize: "13px" }}
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
