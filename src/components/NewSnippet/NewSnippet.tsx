"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Plus } from "lucide-react";
import { Editor } from "@/components/Editor/Editor";
import { LanguageSelect } from "@/ui/LanguageSelect";
import { FolderSelect } from "@/ui/FolderSelect";
import { ShortcutHint } from "@/ui/ShortcutHint";
import { DEFAULT_LANGUAGE, detectLanguageFromTitle, normalizeTitleExtension, type LanguageId } from "@/lib/constants/languages";
import type { FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";

interface NewSnippetProps {
  copy: Dictionary;
  folders: FolderRecord[];
  defaultFolderId?: string | null;
  defaultLanguage?: LanguageId;
  /** Soft-wrap long code lines instead of scrolling horizontally. */
  codeWrap?: boolean;
  /** Bumped when a keyboard shortcut opens this form; focuses the title field. */
  focusNonce?: number;
  /** When rendered inside a host surface (e.g. the create-snippet modal), drop
   *  the card chrome (rounded border) so the form attaches flush to the host's
   *  header separator. */
  embedded?: boolean;
  onCreateSnippet: (data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }) => void;
}

export function NewSnippet({
  copy,
  folders,
  defaultFolderId,
  defaultLanguage = DEFAULT_LANGUAGE,
  codeWrap = false,
  focusNonce = 0,
  embedded = false,
  onCreateSnippet,
}: NewSnippetProps) {
  // When embedded in a dialog host (the create-snippet modal), portalled
  // dropdowns must render above the dialog layer instead of the base menu layer.
  const menuZIndex = embedded ? "var(--z-dialog-menu)" : undefined;

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<LanguageId>(defaultLanguage);
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [code, setCode] = useState("");

  // Focus the title when a shortcut requests it (nonce > 0). Tracking the last
  // handled value covers both an in-place bump and a fresh mount after the app
  // navigated home from the editor/folder view.
  const titleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const handledFocusNonce = useRef(0);
  useEffect(() => {
    if (focusNonce > 0 && focusNonce !== handledFocusNonce.current) {
      handledFocusNonce.current = focusNonce;
      titleRef.current?.focus();
    }
  }, [focusNonce]);

  // Sync the pre-selected folder coming from the aside context menu by adjusting
  // state during render when the prop changes — no effect needed.
  const [prevDefaultFolderId, setPrevDefaultFolderId] = useState(defaultFolderId);
  if (defaultFolderId !== prevDefaultFolderId) {
    setPrevDefaultFolderId(defaultFolderId);
    if (defaultFolderId != null) setFolderId(defaultFolderId);
  }

  // Same pattern for the preferred default language: pick it up when the stored
  // preference loads (or changes) so the dropdown reflects the user's choice.
  const [prevDefaultLanguage, setPrevDefaultLanguage] = useState(defaultLanguage);
  if (defaultLanguage !== prevDefaultLanguage) {
    setPrevDefaultLanguage(defaultLanguage);
    setLanguage(defaultLanguage);
  }

  // Auto-select the language when the title carries a recognizable extension
  // (e.g. `index.html` → HTML). A manual dropdown choice still wins until the
  // user types another recognized extension.
  function handleTitleChange(value: string) {
    setTitle(value);
    const detected = detectLanguageFromTitle(value);
    if (detected) setLanguage(detected);
  }

  // Enter in the title hands focus to the editor so you can type the code right
  // away. Mod+Enter is left alone so the form-level submit shortcut still fires.
  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      editorRef.current?.view?.focus();
    }
  }

  // ⌘/Ctrl+Enter submits from anywhere in the form (title input or editor).
  // Mod+Enter isn't bound in CodeMirror's keymap, so the event bubbles here.
  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;

    onCreateSnippet({
      title: normalizeTitleExtension(title),
      language,
      folderId,
      code,
    });

    setTitle("");
    setLanguage(defaultLanguage);
    setFolderId(defaultFolderId ?? "");
    setCode("");
  }

  return (
    <section className={embedded ? "bg-surface" : "rounded-xl border border-ink/[0.06] bg-surface"}>
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
        {/* Title + Language row */}
        <div className="flex flex-col gap-3 border-b border-ink/[0.06] px-4 py-3 sm:flex-row sm:items-center">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            aria-label={copy.forms.snippetTitlePlaceholder}
            placeholder={copy.forms.snippetNamePlaceholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-faint outline-none"
          />
          <LanguageSelect
            value={language}
            onChange={setLanguage}
            copy={copy.languageSelect}
            menuZIndex={menuZIndex}
          />
        </div>

        {/* Editor */}
        <div className="min-h-[200px]">
          <Editor
            editorRef={editorRef}
            value={code}
            onChange={setCode}
            language={language}
            placeholder={copy.forms.snippetCodePlaceholder}
            height="200px"
            fontSize={13}
            gutterBackground="var(--surface)"
            lineWrapping={codeWrap}
          />
        </div>

        {/* Footer: folder selector + create button */}
        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5">
          <FolderSelect
            value={folderId}
            onChange={setFolderId}
            folders={folders}
            rootLabel={copy.workspace.rootOption}
            copy={copy.folderSelect}
            menuZIndex={menuZIndex}
          />

          <button
            type="submit"
            disabled={!code.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>{copy.forms.submitSnippet}</span>
            <ShortcutHint id="createSnippet" tone="dark" className="ml-0.5 max-lg:hidden" />
          </button>
        </div>
      </form>
    </section>
  );
}
