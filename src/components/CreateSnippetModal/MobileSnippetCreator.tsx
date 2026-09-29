"use client";

import { useId, useRef } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Maximize2, X } from "lucide-react";

import { Editor } from "@/components/Editor/Editor";
import { useSnippetDraft } from "@/components/NewSnippet/useSnippetDraft";
import type { NewSnippetData } from "@/components/NewSnippet/NewSnippet";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { useVisibleViewport } from "@/hooks/useVisibleViewport";
import { TOUCH_TARGET_Y } from "@/lib/constants/layout";
import type { LanguageId } from "@/lib/constants/languages";
import type { FolderRecord } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { FolderSelect } from "@/ui/FolderSelect";
import { IconButton } from "@/ui/IconButton";
import { LanguageSelect } from "@/ui/LanguageSelect";

interface MobileSnippetCreatorProps {
  copy: Dictionary;
  folders: FolderRecord[];
  defaultFolderId: string | null;
  defaultLanguage?: LanguageId;
  codeWrap?: boolean;
  onCreateSnippet: (data: NewSnippetData) => Promise<string | undefined>;
  /** Creates the snippet and hands off to the full editor. */
  onOpenInEditor: (data: NewSnippetData) => void;
  onClose: () => void;
}

/**
 * Touch-layout counterpart of the create-snippet modal: a full-screen page, like
 * writing a message. The code gets every pixel the keyboard leaves free, and
 * language / folder / Create share one slim toolbar right above the keys, where
 * the thumb is. "Open in editor" is a secondary icon in the top bar.
 */
export function MobileSnippetCreator({
  copy,
  folders,
  defaultFolderId,
  defaultLanguage,
  codeWrap,
  onCreateSnippet,
  onOpenInEditor,
  onClose,
}: MobileSnippetCreatorProps) {
  const draft = useSnippetDraft({ defaultLanguage, defaultFolderId });
  const titleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const panelRef = useDialogA11y({ onClose, initialFocusRef: titleRef });
  const headingId = useId();
  // The on-screen keyboard shrinks the visual viewport but not the layout one;
  // fitting the panel to it keeps the toolbar above the keys.
  const viewport = useVisibleViewport();
  // The parent closes the creator once the snippet is saved; until then a second
  // tap must not create a duplicate. A failed save re-arms it so the user can retry.
  const submitted = useRef(false);

  function submit(handler: (data: NewSnippetData) => unknown) {
    if (submitted.current) return;
    submitted.current = true;
    Promise.resolve(handler(draft.toData())).catch((error: unknown) => {
      submitted.current = false;
      console.error("Failed to create snippet", error);
    });
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="klipcode-slide-up-animate fixed inset-x-0 klipcode-z-dialog-sticky flex flex-col bg-surface focus:outline-none"
      style={{ top: viewport.offsetTop, height: viewport.height || "100dvh" }}
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-ink/[0.06] px-2">
        <IconButton
          aria-label={copy.common.close}
          onClick={onClose}
          className="text-ink/55 hover:bg-ink/6 hover:text-ink/80"
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
        <h2 id={headingId} className="flex-1 text-[13px] font-medium text-ink/90">
          {copy.forms.snippetTitle}
        </h2>
        <IconButton
          aria-label={copy.forms.openInEditor}
          onClick={() => submit(onOpenInEditor)}
          className="text-ink/55 hover:bg-ink/6 hover:text-ink/80"
        >
          <Maximize2 size={15} aria-hidden="true" />
        </IconButton>
      </header>

      {/* 16px text so iOS doesn't zoom the page on focus. Enter moves on to the code. */}
      <input
        ref={titleRef}
        type="text"
        value={draft.title}
        onChange={(e) => draft.setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          editorRef.current?.view?.focus();
        }}
        aria-label={copy.forms.snippetTitlePlaceholder}
        placeholder={copy.forms.snippetNamePlaceholder}
        enterKeyHint="next"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="klipcode-editable-focus w-full shrink-0 border-b border-ink/[0.06] bg-transparent px-4 py-3.5 text-base text-foreground outline-none placeholder:text-faint"
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          editorRef={editorRef}
          value={draft.code}
          onChange={draft.setCode}
          language={draft.language}
          placeholder={copy.forms.snippetCodePlaceholder}
          height="100%"
          fontSize={14}
          gutterBackground="var(--surface)"
          lineWrapping={codeWrap}
        />
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-ink/[0.06] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <LanguageSelect
          value={draft.language}
          onChange={draft.setLanguage}
          copy={copy.languageSelect}
          menuZIndex="var(--z-dialog-menu)"
        />
        {/* Lets the folder chip truncate instead of pushing Create off-screen. */}
        <div className="min-w-0">
          <FolderSelect
            value={draft.folderId}
            onChange={draft.setFolderId}
            folders={folders}
            rootLabel={copy.workspace.rootOption}
            copy={copy.folderSelect}
            menuZIndex="var(--z-dialog-menu)"
          />
        </div>
        <button
          type="button"
          onClick={() => submit(onCreateSnippet)}
          className={`${TOUCH_TARGET_Y} ml-auto h-8 shrink-0 rounded-lg bg-accent px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90`}
        >
          {copy.forms.submitSnippetShort}
        </button>
      </footer>
    </div>
  );
}
