"use client";

import { useState, type MouseEvent } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy, MoreVertical, Sparkles, Trash2 } from "lucide-react";

import { LanguageSelect } from "@/ui/LanguageSelect";
import { Tooltip } from "@/ui/Tooltip";
import {
  ContextMenu,
  type ContextMenuGroup,
} from "@/components/ContextMenu/ContextMenu";
import { FormatErrorToast } from "@/components/FormatErrorToast/FormatErrorToast";
import { formatCode, isFormattable } from "@/lib/formatCode";
import type { LanguageId } from "@/lib/constants/languages";
import type { Dictionary } from "@/i18n";
import { copyTextToClipboard } from "@/lib/utils";
import type { MarkdownEditorCopy } from "./MarkdownEditor";

/**
 * NodeView for fenced code blocks: keeps the highlighted `<pre><code>` content
 * editable and overlays the shared LanguageSelect so the block's language (the
 * Markdown fence info string) can be changed in place, plus two hover-revealed
 * controls — always visible on touch/mobile, hover-revealed from `md` up:
 * a copy button, and (when editable) a "⋮" menu to format or delete the block.
 * The copy button is also available on read-only snippets, where the picker and
 * menu are not.
 */
export function CodeBlockComponent({
  node,
  updateAttributes,
  extension,
  editor,
  getPos,
  deleteNode,
}: NodeViewProps) {
  const language = (node.attrs.language as string) || "plaintext";
  const copy = extension.options.languageSelectCopy as Dictionary["languageSelect"];
  const copyLabels = extension.options.copyLabels as
    | MarkdownEditorCopy["codeBlock"]
    | null;

  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [formatting, setFormatting] = useState(false);
  // Bumped each time a format attempt fails, driving the shared error toast.
  const [formatErrorNonce, setFormatErrorNonce] = useState(0);

  const handleCopy = async () => {
    if (!(await copyTextToClipboard(node.textContent))) {
      setCopied(false);
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = async () => {
    setFormatting(true);
    try {
      const formatted = await formatCode(node.textContent, language);
      // Re-resolve the block's live position: the doc may have changed while
      // Prettier (dynamically imported) was loading and running.
      const pos = getPos();
      if (typeof pos !== "number") return;
      const current = editor.state.doc.nodeAt(pos);
      if (!current || current.textContent === formatted) return;
      editor.view.dispatch(
        editor.state.tr.insertText(formatted, pos + 1, pos + current.nodeSize - 1),
      );
    } catch {
      // Unparseable source (e.g. a syntax error): keep the code, warn the user.
      setFormatErrorNonce((n) => n + 1);
    } finally {
      setFormatting(false);
    }
  };

  const openMenu = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  const menuGroups: ContextMenuGroup[] = [];
  if (copyLabels && isFormattable(language)) {
    menuGroups.push({
      items: [
        {
          id: "format",
          label: copyLabels.format,
          Icon: Sparkles,
          onClick: handleFormat,
          disabled: formatting,
        },
      ],
    });
  }
  if (copyLabels) {
    menuGroups.push({
      items: [
        {
          id: "delete",
          label: copyLabels.delete,
          Icon: Trash2,
          variant: "destructive",
          onClick: () => deleteNode(),
        },
      ],
    });
  }

  // Shared visibility rules for the overlaid controls: always shown on
  // touch/mobile, hover-revealed from `md` up (and kept visible while the
  // control is active — copied confirmation or an open menu).
  const controlClass = (active: boolean) =>
    [
      "flex h-7 w-7 items-center justify-center rounded-md text-ink/45 transition-all",
      "hover:bg-ink/[0.08] hover:text-ink/90 focus-visible:opacity-100",
      active ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
    ].join(" ");

  return (
    <NodeViewWrapper className="klipcode-md-codeblock group">
      <div
        className="klipcode-md-codeblock-lang"
        contentEditable={false}
        // Keep clicks on the controls from moving the editor selection.
        onMouseDown={(e) => e.stopPropagation()}
      >
        {editor.isEditable && menuGroups.length > 0 && (
          <Tooltip content={copyLabels!.options} placement="top">
            <button
              type="button"
              aria-label={copyLabels!.options}
              aria-haspopup="menu"
              aria-expanded={menu !== null}
              onClick={openMenu}
              className={controlClass(menu !== null || formatting)}
            >
              <MoreVertical size={13} className={formatting ? "animate-pulse" : undefined} />
            </button>
          </Tooltip>
        )}
        {copyLabels && (
          <Tooltip content={copied ? copyLabels.copied : copyLabels.copy} placement="top">
            <button
              type="button"
              aria-label={copyLabels.copy}
              onClick={handleCopy}
              className={controlClass(copied)}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </Tooltip>
        )}
        {editor.isEditable && (
          <LanguageSelect
            value={language as LanguageId}
            onChange={(value) => updateAttributes({ language: value })}
            copy={copy}
          />
        )}
      </div>
      <pre spellCheck={false}>
        <NodeViewContent as="code" />
      </pre>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          groups={menuGroups}
          onClose={() => setMenu(null)}
        />
      )}

      {copyLabels && (
        <FormatErrorToast nonce={formatErrorNonce} message={copyLabels.formatError} />
      )}
    </NodeViewWrapper>
  );
}
