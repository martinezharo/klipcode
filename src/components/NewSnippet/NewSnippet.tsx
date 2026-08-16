"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Maximize2, Plus } from "lucide-react";
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
  /** Lets a dialog host claim the title field as its initial focus target, so
   *  its focus trap doesn't land on the close button instead. */
  titleFieldRef?: React.RefObject<HTMLInputElement | null>;
  onCreateSnippet: (data: NewSnippetData) => void;
  /** Creates the snippet and hands the user off to the full editor. Optional so
   *  hosts that have nowhere to navigate can omit the secondary action. */
  onOpenInEditor?: (data: NewSnippetData) => void;
}

export interface NewSnippetData {
  title: string;
  language: string;
  folderId: string;
  code: string;
}

export function NewSnippet({
  copy,
  folders,
  defaultFolderId,
  defaultLanguage = DEFAULT_LANGUAGE,
  codeWrap = false,
  focusNonce = 0,
  embedded = false,
  titleFieldRef,
  onCreateSnippet,
  onOpenInEditor,
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
  const ownTitleRef = useRef<HTMLInputElement>(null);
  const titleRef = titleFieldRef ?? ownTitleRef;
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const handledFocusNonce = useRef(0);
  useEffect(() => {
    if (focusNonce > 0 && focusNonce !== handledFocusNonce.current) {
      handledFocusNonce.current = focusNonce;
      titleRef.current?.focus();
    }
    // The ref identity is stable for a given host; only the nonce should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ⌘/Ctrl+Enter creates; ⇧⌘/Ctrl+Enter creates and opens the editor. Neither
  // combo is bound in CodeMirror's keymap, so the events bubble here from both
  // the title input and the editor.
  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      if (onOpenInEditor) submit(onOpenInEditor);
      return;
    }
    event.currentTarget.requestSubmit();
  }

  // Empty snippets are allowed: a titled placeholder you fill in later is
  // legitimate, and "open in editor" depends on being able to create with no
  // code at all.
  function submit(handler: (data: NewSnippetData) => void) {
    handler({
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(onCreateSnippet);
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

        {/* Footer: folder selector + actions.
            On touch each control sits on its own full-width row — side by side
            they squeezed the destination into a chip and the primary action
            into a target barely wider than its own label. Destination first,
            action last, so the primary lands closest to the thumb.

            Every row is full width, but only the primary is full height — the
            destination stays a slim strip and the secondary sits between them
            at 40px, so the three never read as equals. The gap must clear the
            select's 44px phantom hit area (6px of overhang per side) to avoid
            stealing taps from the buttons. */}
        <div className="flex flex-col gap-2.5 border-t border-ink/[0.06] px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
          <FolderSelect
            value={folderId}
            onChange={setFolderId}
            folders={folders}
            rootLabel={copy.workspace.rootOption}
            copy={copy.folderSelect}
            menuZIndex={menuZIndex}
            blockOnTouch
          />

          {/* The secondary carries no fill so the footer keeps exactly one
              obvious action even with two buttons in it. */}
          {onOpenInEditor && (
            <button
              type="button"
              onClick={() => submit(onOpenInEditor)}
              title={copy.shortcuts.items.openInEditor}
              className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink/60 transition-colors hover:bg-ink/[0.06] hover:text-ink/85 max-lg:h-10 max-lg:w-full lg:ml-auto lg:mr-1"
            >
              <Maximize2 size={13} aria-hidden="true" />
              <span>{copy.forms.openInEditor}</span>
            </button>
          )}

          <button
            type="submit"
            aria-label={copy.forms.submitSnippet}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 max-lg:h-11 max-lg:w-full"
          >
            <Plus size={14} strokeWidth={2.5} />
            {/* Keep the visible label aligned with the button's accessible name
                on every breakpoint; the shortcut hint remains supplemental. */}
            <span>{copy.forms.submitSnippet}</span>
            <ShortcutHint id="createSnippet" tone="dark" className="ml-0.5 max-lg:hidden" />
          </button>
        </div>
      </form>
    </section>
  );
}
