"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useEditor,
  EditorContent,
  BubbleMenu,
  ReactNodeViewRenderer,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight, {
  type CodeBlockLowlightOptions,
} from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  SquareCode,
  Table as TableIcon,
  Minus,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns3,
  Rows3,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";

import { Tooltip } from "@/ui/Tooltip";
import type { MarkdownEditorCopy } from "./MarkdownEditor";
import { LinkDialog } from "./LinkDialog";
import { CodeBlockComponent } from "./CodeBlockComponent";
import { SlashCommand, type SlashCommandItem } from "./SlashCommand";
import { ListExitShortcut } from "./ListExitShortcut";
import { MarkdownClipboardUnwrap } from "./MarkdownClipboardUnwrap";
import { SmartLinkPaste } from "./SmartLinkPaste";

// Syntax highlighting inside fenced code blocks. `common` bundles ~35 popular
// grammars (js, ts, python, css, html, json, bash, …) — enough for snippets,
// without pulling in every highlight.js language.
const lowlight = createLowlight(common);

// Code block with the shared LanguageSelect and a copy button overlaid (see
// CodeBlockComponent). Copy is threaded through extension options to the NodeView.
interface CodeBlockOptions extends CodeBlockLowlightOptions {
  languageSelectCopy: MarkdownEditorCopy["languageSelect"] | null;
  copyLabels: MarkdownEditorCopy["codeBlock"] | null;
}

const CodeBlock = CodeBlockLowlight.extend<CodeBlockOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      languageSelectCopy: null,
      copyLabels: null,
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Slash command items
// ──────────────────────────────────────────────────────────────────────────────

function buildSlashItems(
  copy: MarkdownEditorCopy["slash"],
  defaultCodeLanguage: string,
): SlashCommandItem[] {
  const ICON = 16;
  return [
    {
      title: copy.heading1Title,
      description: copy.heading1Desc,
      icon: <Heading1 size={ICON} />,
      keywords: ["h1", "title", "heading"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
    },
    {
      title: copy.heading2Title,
      description: copy.heading2Desc,
      icon: <Heading2 size={ICON} />,
      keywords: ["h2", "subtitle", "heading"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
    },
    {
      title: copy.heading3Title,
      description: copy.heading3Desc,
      icon: <Heading3 size={ICON} />,
      keywords: ["h3", "heading"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
    },
    {
      title: copy.bulletListTitle,
      description: copy.bulletListDesc,
      icon: <List size={ICON} />,
      keywords: ["ul", "unordered", "bullet"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: copy.orderedListTitle,
      description: copy.orderedListDesc,
      icon: <ListOrdered size={ICON} />,
      keywords: ["ol", "ordered", "number"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: copy.taskListTitle,
      description: copy.taskListDesc,
      icon: <ListChecks size={ICON} />,
      keywords: ["todo", "task", "checkbox", "check"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      title: copy.blockquoteTitle,
      description: copy.blockquoteDesc,
      icon: <Quote size={ICON} />,
      keywords: ["quote", "blockquote", "citation"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: copy.codeBlockTitle,
      description: copy.codeBlockDesc,
      icon: <SquareCode size={ICON} />,
      keywords: ["code", "snippet", "fence", "pre"],
      run: (editor, range) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setCodeBlock({ language: defaultCodeLanguage })
          .run(),
    },
    {
      title: copy.tableTitle,
      description: copy.tableDesc,
      icon: <TableIcon size={ICON} />,
      keywords: ["table", "grid"],
      run: (editor, range) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      title: copy.dividerTitle,
      description: copy.dividerDesc,
      icon: <Minus size={ICON} />,
      keywords: ["divider", "hr", "rule", "separator"],
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Floating formatting toolbar (Notion-style) shown over a text selection.
// ──────────────────────────────────────────────────────────────────────────────

function BubbleButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} placement="top">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={[
          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          active ? "bg-ink/[0.12] text-foreground" : "text-ink/55 hover:bg-ink/[0.08] hover:text-ink/90",
        ].join(" ")}
      >
        {children}
      </button>
    </Tooltip>
  );
}

const SEP = <div className="mx-0.5 h-5 w-px bg-ink/[0.1]" />;

function FormattingMenu({ editor, copy }: { editor: Editor; copy: MarkdownEditorCopy }) {
  const t = copy.toolbar;
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState<string | undefined>();

  const openLink = () => {
    // Capture the current link href *before* focus leaves the editor, so the
    // dialog can pre-fill it and decide between "insert" / "edit" wording.
    setLinkHref((editor.getAttributes("link").href as string | undefined) ?? undefined);
    setLinkOpen(true);
  };

  const applyLink = (url: string) => {
    setLinkOpen(false);
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const removeLink = () => {
    setLinkOpen(false);
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        // maxWidth: "none" — tippy caps the box at 350px by default, which clips
        // the rightmost buttons (code block, link) now that the toolbar is wider.
        tippyOptions={{ duration: 120, maxWidth: "none" }}
        // Hide on empty selections and inside code blocks (marks don't apply there).
        shouldShow={({ editor, state }) =>
          !state.selection.empty && !editor.isActive("codeBlock")
        }
        className="klipcode-bubble-menu flex items-center gap-0.5 rounded-lg border border-ink/[0.1] p-1 klipcode-popover-shadow"
      >
        <BubbleButton label={t.bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </BubbleButton>
        <BubbleButton label={t.italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </BubbleButton>
        <BubbleButton label={t.strike} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={14} />
        </BubbleButton>
        <BubbleButton label={t.code} active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={14} />
        </BubbleButton>
        {SEP}
        <BubbleButton label={t.heading1} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={14} />
        </BubbleButton>
        <BubbleButton label={t.heading2} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </BubbleButton>
        <BubbleButton label={t.heading3} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={14} />
        </BubbleButton>
        {SEP}
        <BubbleButton label={t.bulletList} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </BubbleButton>
        <BubbleButton label={t.orderedList} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </BubbleButton>
        <BubbleButton label={t.taskList} active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks size={14} />
        </BubbleButton>
        <BubbleButton label={t.quote} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </BubbleButton>
        <BubbleButton label={t.codeBlock} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <SquareCode size={14} />
        </BubbleButton>
        {SEP}
        <BubbleButton label={t.link} active={editor.isActive("link")} onClick={openLink}>
          <LinkIcon size={14} />
        </BubbleButton>
      </BubbleMenu>

      {linkOpen && (
        <LinkDialog
          initialHref={linkHref}
          copy={copy.linkDialog}
          onCancel={() => setLinkOpen(false)}
          onSubmit={applyLink}
          onRemove={removeLink}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// In-table controls — shown when the caret sits in a table cell (no selection),
// so it never overlaps the text-formatting bubble menu.
// ──────────────────────────────────────────────────────────────────────────────

function TableMenu({ editor, copy }: { editor: Editor; copy: MarkdownEditorCopy["table"] }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor, state }) => editor.isActive("table") && state.selection.empty}
      tippyOptions={{ duration: 120, placement: "top", maxWidth: "none" }}
      className="klipcode-bubble-menu flex items-center gap-0.5 rounded-lg border border-ink/[0.1] p-1 klipcode-popover-shadow"
    >
      <BubbleButton label={copy.addColumnBefore} onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <ArrowLeftToLine size={14} />
      </BubbleButton>
      <BubbleButton label={copy.addColumnAfter} onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <ArrowRightToLine size={14} />
      </BubbleButton>
      <BubbleButton label={copy.deleteColumn} onClick={() => editor.chain().focus().deleteColumn().run()}>
        <Columns3 size={14} />
      </BubbleButton>
      {SEP}
      <BubbleButton label={copy.addRowBefore} onClick={() => editor.chain().focus().addRowBefore().run()}>
        <ArrowUpToLine size={14} />
      </BubbleButton>
      <BubbleButton label={copy.addRowAfter} onClick={() => editor.chain().focus().addRowAfter().run()}>
        <ArrowDownToLine size={14} />
      </BubbleButton>
      <BubbleButton label={copy.deleteRow} onClick={() => editor.chain().focus().deleteRow().run()}>
        <Rows3 size={14} />
      </BubbleButton>
      {SEP}
      <Tooltip content={copy.deleteTable} placement="top">
        <button
          type="button"
          aria-label={copy.deleteTable}
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 size={14} />
        </button>
      </Tooltip>
    </BubbleMenu>
  );
}

// Clicking the empty space below the content gives a fresh line to type in:
// append an empty paragraph at the end (unless the last block is already an empty
// paragraph) and place the caret there.
function focusWithTrailingLine(editor: Editor) {
  const last = editor.state.doc.lastChild;
  const lastIsEmptyParagraph =
    last?.type.name === "paragraph" && last.content.size === 0;

  if (lastIsEmptyParagraph) {
    editor.chain().focus("end").run();
    return;
  }

  editor
    .chain()
    .command(({ tr, dispatch }) => {
      if (dispatch) tr.insert(tr.doc.content.size, editor.schema.nodes.paragraph.create());
      return true;
    })
    .focus("end")
    .run();
}

// ──────────────────────────────────────────────────────────────────────────────
// Editor
// ──────────────────────────────────────────────────────────────────────────────

export interface MarkdownEditorInnerProps {
  value: string;
  onChange: (markdown: string) => void;
  editable: boolean;
  /** See MarkdownEditorProps.active — false while hidden behind the source pane. */
  active?: boolean;
  defaultCodeLanguage: string;
  copy: MarkdownEditorCopy;
}

export default function MarkdownEditorInner({
  value,
  onChange,
  editable,
  active = true,
  defaultCodeLanguage,
  copy,
}: MarkdownEditorInnerProps) {
  // Keep the latest onChange without re-creating the editor instance.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Localized slash-menu items — rebuilt only if copy or the default language change.
  const slashItems = useMemo(
    () => buildSlashItems(copy.slash, defaultCodeLanguage),
    [copy.slash, defaultCodeLanguage],
  );

  // Last Markdown this editor produced (or consumed on mount). Compared against
  // `value` on re-activation instead of re-serializing, so tiptap-markdown's
  // formatting normalization can't produce a false "source changed" positive.
  const lastMarkdownRef = useRef(value);

  const editor = useEditor({
    // The editor renders only on the client (lazy boundary) — avoid SSR markup.
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        // Inline code is verbatim — don't let the browser flag it as misspelt.
        code: { HTMLAttributes: { spellcheck: "false" } },
      }),
      CodeBlock.configure({
        lowlight,
        // Highlight fallback only — kept neutral so bare ``` fences in existing
        // documents aren't silently rewritten with a language on save. New blocks
        // inserted via the slash menu get the user's default language explicitly.
        defaultLanguage: "plaintext",
        languageSelectCopy: copy.languageSelect,
        copyLabels: copy.codeBlock,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        // Only autolink while typing when the URL carries an explicit http(s)
        // scheme. Bare domains are skipped on purpose: in a code-focused app,
        // common file names collide with real TLDs (e.g. `deploy.sh`, `.io`),
        // so typing them shouldn't silently become a link. Manual links via the
        // dialog and smart paste still accept any URL (they don't use this).
        shouldAutoLink: (url) => /^https?:\/\//i.test(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: copy.placeholder }),
      Markdown.configure({ html: false, tightLists: true, transformPastedText: true, transformCopiedText: true }),
      MarkdownClipboardUnwrap,
      SmartLinkPaste,
      SlashCommand.configure({
        items: slashItems,
        emptyText: copy.slash.noResults,
        groupLabel: copy.slash.group,
      }),
      ListExitShortcut,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "klipcode-md focus:outline-none",
        // Enable spellcheck for prose; the browser still honours its own
        // spellcheck setting (users who turned it off see nothing). Code blocks
        // and inline code opt back out below so identifiers aren't flagged.
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      lastMarkdownRef.current = markdown;
      onChangeRef.current(markdown);
    },
  });

  // Reflect read-only state (e.g. a trashed snippet) without rebuilding the doc.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const wasActiveRef = useRef(active);
  useEffect(() => {
    if (!editor || wasActiveRef.current === active) return;
    wasActiveRef.current = active;
    if (!active) return;
    // While hidden the source editor may have rewritten the document; TipTap
    // consumed `value` once on mount, so replace the doc only if it actually
    // diverged — otherwise cursor, DOM and scroll position survive untouched.
    if (value !== lastMarkdownRef.current) {
      lastMarkdownRef.current = value;
      editor.commands.setContent(value, false);
    }
    if (editable) editor.commands.focus(null, { scrollIntoView: false });
  }, [active, editor, value, editable]);

  return (
    <div
      className="h-full overflow-y-auto"
      // Clicking the blank area below the content drops a fresh line and focuses
      // it — a Notion-like affordance so the whole pane feels writable.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && editor && editable) {
          e.preventDefault();
          focusWithTrailingLine(editor);
        }
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-8 pr-10">
        {editor && editable && <FormattingMenu editor={editor} copy={copy} />}
        {editor && editable && <TableMenu editor={editor} copy={copy.table} />}
        <EditorContent editor={editor} />
        {editor && editable && (
          <div
            aria-hidden
            className="cursor-text"
            style={{ minHeight: "clamp(6rem, 30vh, 18rem)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              focusWithTrailingLine(editor);
            }}
          />
        )}
      </div>
    </div>
  );
}
