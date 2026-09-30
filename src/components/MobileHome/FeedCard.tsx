"use client";

import { useState } from "react";
import { Check, Copy, Folder, MoreHorizontal, Pin } from "lucide-react";

import { CodePreview } from "@/components/SnippetCards/snippetPreview";
import { GeneratingTitle, useIsGeneratingTitle } from "@/components/TitleGeneration";
import type { Dictionary } from "@/i18n";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useLongPress, type PressPoint } from "@/hooks/useLongPress";
import { TOUCH_TARGET } from "@/lib/constants/layout";
import type { SnippetRecord } from "@/lib/types";
import {
  cn,
  getSnippetDisplayName,
  getSnippetFileName,
  resolveSnippetRename,
} from "@/lib/utils";
import { LanguageIcon } from "@/ui/LanguageIcon";

/**
 * A snippet as one row of the mobile feed.
 *
 * This is the single row shape the whole mobile home is built from: both tabs
 * render it, so switching between recency and folder structure never changes
 * what a snippet looks like or how it behaves.
 *
 * Two lines of real code do the identifying work that a filename alone can't,
 * and copy is a first-class control on the row rather than an entry in an
 * overflow menu — copying a snippet's content is the product's first priority,
 * and on touch it used to cost opening the snippet first.
 *
 * Everything else lives in the row's menu, opened by pressing and holding the
 * card — the platform convention on touch, and it leaves copy as the card's one
 * visible control. A mouse (a narrow desktop window) gets the ⋯ back, since
 * nothing tells a cursor that holding does anything; right-click works too.
 */
export function FeedCard({
  snippet,
  copy,
  folderName,
  isActive,
  isRenaming,
  onOpen,
  onOpenMenu,
  onSubmitRename,
  onCancelRename,
}: {
  snippet: SnippetRecord;
  copy: Dictionary;
  /** Shown as a chip when the row's folder isn't implied by its surroundings. */
  folderName: string | null;
  /** The snippet currently open in the editor — highlighted on return. */
  isActive: boolean;
  isRenaming: boolean;
  onOpen: () => void;
  /** Opens the row's actions menu, anchored at viewport coordinates. */
  onOpenMenu: (point: PressPoint) => void;
  onSubmitRename: (value: string) => void;
  onCancelRename: () => void;
}) {
  const { copied, copy: copyToClipboard } = useCopyFeedback();
  // Off while renaming: holding inside the field has to select text.
  const longPress = useLongPress(onOpenMenu, { enabled: !isRenaming });
  const isGeneratingTitle = useIsGeneratingTitle(snippet.id);
  const displayName = getSnippetDisplayName(
    snippet.title,
    snippet.language,
    copy.snippetCard.untitled,
  );

  return (
    <article
      {...longPress}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border p-3 transition-colors",
        // No text selection or iOS callout on hold: the hold opens the menu.
        !isRenaming && "select-none [-webkit-touch-callout:none]",
        isActive
          ? "border-ink/25 bg-ink/[0.05]"
          : "border-ink/8 bg-surface active:bg-surface-hover",
      )}
    >
      {isRenaming ? (
        <RenameField
          snippet={snippet}
          onSubmit={onSubmitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={isGeneratingTitle ? copy.snippetCard.generatingTitle : displayName}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-1.5">
            <LanguageIcon language={snippet.language} size={15} className="shrink-0" />
            {isGeneratingTitle ? (
              <GeneratingTitle
                label={copy.snippetCard.generatingTitle}
                className="min-w-0 flex-1 text-[14px] font-medium"
              />
            ) : (
              <span className="min-w-0 truncate text-[14px] font-medium text-foreground">
                {displayName}
              </span>
            )}
            {snippet.isPinnedHome && (
              <>
                <Pin size={11} className="shrink-0 text-ink/30" aria-hidden="true" />
                <span className="sr-only">{copy.aside.pinned}</span>
              </>
            )}
          </span>

          <CodePreview
            code={snippet.code}
            language={snippet.language}
            lines={2}
            fadeFrom={isActive ? "from-transparent" : "from-surface"}
            className="mt-1.5"
          />

          {folderName && (
            <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint">
              <Folder size={11} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{folderName}</span>
            </span>
          )}
        </button>
      )}

      {/* 36px boxes with a 12px gap: their invisible 44px targets tile instead
          of stealing each other's taps (see TOUCH_TARGET). */}
      <span className="flex shrink-0 flex-col items-center gap-1.5 self-center">
        {/* Only for a mouse — a finger holds the card instead. Hidden visually
            rather than removed, so screen readers, which can't hold, keep it. */}
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
          aria-label={copy.contextMenu.moreOptions}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-ink/35 transition-colors active:bg-ink/8 pointer-coarse:sr-only",
            TOUCH_TARGET,
          )}
        >
          <MoreHorizontal size={16} />
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard(snippet.code)}
          aria-label={copy.contextMenu.copyContent}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:bg-ink/8",
            copied ? "text-foreground" : "text-ink/45",
            TOUCH_TARGET,
          )}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </span>
    </article>
  );
}

/**
 * Inline rename, editing the snippet's *filename*. Controlled so the language
 * resolves on every keystroke — typing `.css` flips the leading glyph
 * immediately, exactly as the desktop tree row does.
 */
function RenameField({
  snippet,
  onSubmit,
  onCancel,
}: {
  snippet: SnippetRecord;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(() =>
    getSnippetFileName(snippet.title, snippet.language),
  );
  const previewLanguage = resolveSnippetRename(value, snippet.language).language;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
      <LanguageIcon language={previewLanguage} size={15} className="shrink-0" />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => onSubmit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onSubmit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") onCancel();
        }}
        className="klipcode-editable-focus min-w-0 flex-1 rounded-md bg-ink/[0.07] px-2 py-1.5 text-[14px] text-foreground outline-none ring-1 ring-ink/15 transition-shadow focus:ring-ink/45"
      />
    </span>
  );
}
