"use client";

import { lazy, Suspense } from "react";

import type { Dictionary } from "@/i18n";
import type { LanguageId } from "@/lib/constants/languages";

// TipTap + ProseMirror + lowlight are sizeable; only load the editor when a
// Markdown snippet is actually opened in the WYSIWYG view.
const MarkdownEditorInner = lazy(() => import("./MarkdownEditorInner"));

export interface MarkdownEditorCopy {
  /** Shown in the empty editor before the user types. */
  placeholder: string;
  /** Copy for the link insertion dialog launched from the bubble menu. */
  linkDialog: {
    title: string;
    editTitle: string;
    label: string;
    placeholder: string;
    apply: string;
    cancel: string;
    remove: string;
    invalid: string;
  };
  /** Aria labels for the floating formatting toolbar (bubble menu). */
  toolbar: Dictionary["snippetEditor"]["mdToolbar"];
  /** Labels for the "/" block-inserter menu. */
  slash: Dictionary["snippetEditor"]["mdSlash"];
  /** Labels for the image placeholder, resize handles and hover toolbar. */
  image: Dictionary["snippetEditor"]["mdImage"];
  /** Aria labels for the in-table controls. */
  table: Dictionary["snippetEditor"]["mdTable"];
  /** Labels for the hover copy button and options menu on fenced code blocks. */
  codeBlock: {
    copy: string;
    copied: string;
    /** Aria label / tooltip for the kebab menu trigger. */
    options: string;
    /** "Format" menu item (only shown for Prettier-supported languages). */
    format: string;
    /** "Delete" menu item. */
    delete: string;
    /** Toast shown when formatting fails (e.g. a syntax error). */
    formatError: string;
  };
  /** Reused language picker copy for the code-block language selector. */
  languageSelect: Dictionary["languageSelect"];
}

export interface MarkdownEditorProps {
  /** The Markdown source. Consumed once on mount; the editor owns it afterwards. */
  value: string;
  /** Called with the serialized Markdown on every edit. */
  onChange: (markdown: string) => void;
  /** When false the document is read-only (e.g. a trashed snippet). */
  editable: boolean;
  /** False while the pane is kept mounted but hidden behind the source editor.
   *  Flipping back to true re-syncs the document from `value` if the source
   *  changed meanwhile; cursor and scroll survive without moving DOM focus. */
  active?: boolean;
  /** Language pre-selected on newly inserted code blocks (user preference). */
  defaultCodeLanguage: LanguageId;
  copy: MarkdownEditorCopy;
}

/**
 * Notion-like WYSIWYG editing of a Markdown snippet. Drops in where the code
 * Editor would go; the breadcrumbs and aside stay untouched — only the editing
 * surface is swapped. Edits serialize back to Markdown so the snippet stays a
 * plain `.md` document.
 */
export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <div className="h-4 w-32 animate-pulse rounded bg-ink/[0.06]" />
        </div>
      }
    >
      <MarkdownEditorInner {...props} />
    </Suspense>
  );
}
