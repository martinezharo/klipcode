"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  Copy,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  CircleCheck,
  Pencil,
  Folder,
  FolderOpen,
  Layers,
  Zap,
  Eye,
  Code2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Editor } from "@/components/Editor/Editor";
import { MarkdownEditor } from "@/components/MarkdownPreview/MarkdownEditor";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs/Breadcrumbs";
import { GeneratingTitle, useIsGeneratingTitle } from "@/components/TitleGeneration";
import { LanguageSelect } from "@/ui/LanguageSelect";
import { LanguageIcon } from "@/ui/LanguageIcon";
import { Tooltip } from "@/ui/Tooltip";
import type { LanguageId } from "@/lib/constants/languages";
import type { SnippetRecord, FolderRecord, SyncStatus } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { DEBOUNCE_MS } from "@/lib/constants/timing";
import { formatCode, isFormattable } from "@/lib/formatCode";
import { FormatErrorToast } from "@/components/FormatErrorToast/FormatErrorToast";
import { getFolderPath } from "@/components/FolderView/utils";
import { resolveSnippetRename } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Sync status indicator (top-right of header)
// ──────────────────────────────────────────────────────────────────────────────

function SyncIndicator({
  status,
  copy,
}: {
  status: SyncStatus;
  copy: Dictionary["snippetEditor"];
}) {
  const shared = "flex items-center gap-1.5 text-[11px] font-medium";

  switch (status) {
    case "editing":
      return (
        <span className={`${shared} text-ink/40`}>
          <Pencil size={11} />
          {copy.syncEditing}
        </span>
      );
    case "saving":
      return (
        <span className={`${shared} text-ink/40`}>
          <Loader2 size={11} className="animate-spin" />
          {copy.syncSaving}
        </span>
      );
    case "saved-local":
      return (
        <span className={`${shared} text-ink/40`}>
          <CloudOff size={11} />
          {copy.syncSavedLocal}
        </span>
      );
    case "saved-cloud":
      return (
        <span className={`${shared} text-emerald-500/80`}>
          <CircleCheck size={11} />
          {copy.syncSavedCloud}
        </span>
      );
    case "error":
      return (
        <span className={`${shared} text-danger`}>
          <CloudOff size={11} />
          {copy.syncError}
        </span>
      );
    default:
      return (
        <span className={`${shared} text-faint`}>
          <Cloud size={11} />
          {copy.syncIdle}
        </span>
      );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

export interface SnippetEditorProps {
  snippet: SnippetRecord;
  folders: FolderRecord[];
  copy: Dictionary;
  syncStatus: SyncStatus;
  onClose: () => void;
  onNavigateFolder?: (folderId: string) => void;
  onNavigateHome?: () => void;
  onUpdate: (snippetId: string, changes: { title?: string; code?: string; language?: LanguageId }) => void;
  /** Rename the snippet by full filename (resolved to title + language). The
   *  same mutation used by the aside tree and snippet cards. */
  onRename?: (snippetId: string, value: string) => void;
  /** Whether Markdown snippets open in the Notion-like preview by default. */
  markdownPreviewByDefault?: boolean;
  /** User's default language, pre-selected on code blocks inserted in Markdown. */
  defaultCodeLanguage?: LanguageId;
  /** Soft-wrap long code lines instead of scrolling horizontally. */
  codeWrap?: boolean;
  /** Persisted when the user flips the preview/source toggle — the chosen side
   *  becomes the default side Markdown snippets open on. */
  onMarkdownPreviewChange?: (open: boolean) => void;
  menuButton?: React.ReactNode;
  /** When true the snippet is in the trash: it's shown read-only with a notice
   *  and restore / delete-permanently actions instead of the edit controls. */
  readOnly?: boolean;
  trashActions?: { onRestore: () => void; onDeletePermanently: () => void };
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function SnippetEditor({
  snippet,
  folders,
  copy,
  syncStatus,
  onClose,
  onNavigateFolder,
  onNavigateHome,
  onUpdate,
  onRename,
  markdownPreviewByDefault = true,
  defaultCodeLanguage = "plaintext",
  codeWrap = false,
  onMarkdownPreviewChange,
  menuButton,
  readOnly = false,
  trashActions,
}: SnippetEditorProps) {
  const editorCopy = copy.snippetEditor;
  const isGeneratingTitle = useIsGeneratingTitle(snippet.id);

  const isMarkdown = snippet.language === "markdown";

  // Local state — initialised from snippet once (key={snippet.id} resets on swap)
  const [code, setCode] = useState(snippet.code);
  const [copied, setCopied] = useState(false);
  const [formatting, setFormatting] = useState(false);
  // Bumped each time a format attempt fails, driving the shared error toast.
  const [formatErrorNonce, setFormatErrorNonce] = useState(0);
  // Markdown snippets can swap the code editor for a Notion-like rendered preview;
  // the initial side honours the user's last choice (key={snippet.id} re-seeds
  // it when swapping snippets). Flipping the toggle also persists the choice so
  // the next Markdown snippet opens on the same side.
  const [showPreview, setShowPreview] = useState(isMarkdown && markdownPreviewByDefault);
  // Each side stays mounted once visited: the inactive pane is hidden with
  // `visibility: hidden` (layout is kept, so scroll offset and cursor survive)
  // instead of being unmounted and rebuilt on every toggle.
  const [visited, setVisited] = useState(() => ({
    source: !(isMarkdown && markdownPreviewByDefault),
    preview: isMarkdown && markdownPreviewByDefault,
  }));
  // The source editor's value is frozen while the preview is active so preview
  // keystrokes don't rewrite the hidden CodeMirror doc (wiping its cursor);
  // toggling back hands it the live code — a single replace, only if changed.
  const [sourceFreeze, setSourceFreeze] = useState(snippet.code);

  const sourceEditorRef = useRef<ReactCodeMirrorRef>(null);

  // Inline rename of the snippet title via the breadcrumb crumb itself: the
  // title text is contentEditable, so clicking it places the caret in place
  // and typing edits it directly — no separate field, no layout shift. The icon
  // previews the language resolved from the in-progress text live, mirroring
  // the aside/card rename flows (resolveSnippetRename).
  const canRename = !readOnly && !!onRename;
  // The language previewed by the icon; null ⇒ not actively editing, fall back
  // to the snippet's stored language.
  const [renameIconLanguage, setRenameIconLanguage] = useState<string | null>(null);
  const iconLanguage = renameIconLanguage ?? snippet.language;

  const titleEditable =
    canRename && !isGeneratingTitle && snippet.title.trim().length > 0;

  function handleRenameInput(e: React.FormEvent<HTMLSpanElement>) {
    const text = e.currentTarget.textContent ?? "";
    setRenameIconLanguage(resolveSnippetRename(text, snippet.language).language);
  }

  function handleRenameBlur(e: React.FocusEvent<HTMLSpanElement>) {
    const text = (e.currentTarget.textContent ?? "").trim();
    if (text !== snippet.title.trim()) onRename?.(snippet.id, text);
    setRenameIconLanguage(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.currentTarget.textContent = snippet.title;
      setRenameIconLanguage(null);
      e.currentTarget.blur();
    }
  }

  const handleTogglePreview = useCallback(() => {
    const next = !showPreview;
    setShowPreview(next);
    setVisited((v) => (next ? { ...v, preview: true } : { ...v, source: true }));
    if (next) setSourceFreeze(code);
    onMarkdownPreviewChange?.(next);
  }, [showPreview, code, onMarkdownPreviewChange]);

  // Focus the source editor when flipping back to it so the preserved cursor
  // is immediately usable (the preview pane focuses itself on activation — see
  // MarkdownEditorInner).
  const prevShowPreviewRef = useRef(showPreview);
  useEffect(() => {
    if (prevShowPreviewRef.current === showPreview) return;
    prevShowPreviewRef.current = showPreview;
    if (!showPreview && !readOnly) sourceEditorRef.current?.view?.focus();
  }, [showPreview, readOnly]);

  // Per-field debounce timers
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleCodeChange(next: string) {
    if (readOnly) return;
    setCode(next);

    if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    codeTimerRef.current = setTimeout(() => {
      onUpdate(snippet.id, { code: next });
    }, DEBOUNCE_MS);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFormat() {
    if (!isFormattable(snippet.language)) return;
    setFormatting(true);
    try {
      const next = await formatCode(code, snippet.language);
      setCode(next);
      if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
      codeTimerRef.current = setTimeout(() => {
        onUpdate(snippet.id, { code: next });
      }, 0);
    } catch {
      // Unparseable source (e.g. a syntax error): leave the code untouched
      // and surface the failure via the shared toast.
      setFormatErrorNonce((n) => n + 1);
    } finally {
      setFormatting(false);
    }
  }

  // ── Folder path for breadcrumb ───────────────────────────────────────────
  // For a trashed snippet `folders` is the trashed set, so the path resolves to
  // its (also trashed) ancestor folders and the root crumb points at the trash.
  const folderPath = snippet.folderId ? getFolderPath(snippet.folderId, folders) : [];

  const breadcrumbItems: BreadcrumbItem[] = [
    readOnly
      ? {
          id: "root",
          label: copy.trash.title,
          icon: <Trash2 size={12} aria-hidden="true" />,
          onClick: onNavigateHome ? onNavigateHome : onClose,
        }
      : {
          id: "root",
          label: copy.aside.mySpace,
          icon: <Layers size={12} aria-hidden="true" />,
          onClick: onNavigateHome ? onNavigateHome : onClose,
        },
    ...folderPath.map<BreadcrumbItem>((f) => ({
      id: f.id,
      label: f.name,
      icon: readOnly ? (
        <FolderOpen size={12} aria-hidden="true" />
      ) : (
        <Folder size={12} aria-hidden="true" />
      ),
      onClick: onNavigateFolder ? () => onNavigateFolder(f.id) : onClose,
    })),
    {
      id: snippet.id,
      icon: <LanguageIcon language={iconLanguage} size={12} className="shrink-0" />,
      label: isGeneratingTitle ? (
        <GeneratingTitle label={editorCopy.generatingTitle} />
      ) : titleEditable ? (
        <span
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={handleRenameInput}
          onBlur={handleRenameBlur}
          onKeyDown={handleRenameKeyDown}
          className="px-0.5 -mx-0.5 rounded outline-none transition focus:bg-ink/[0.05] focus:ring-1 focus:ring-ink/15"
        >
          {snippet.title}
        </span>
      ) : snippet.title.trim() ? (
        snippet.title
      ) : (
        <span className="text-faint">{editorCopy.titlePlaceholder}</span>
      ),
      raw: titleEditable,
    },
  ];

  const canFormat = isFormattable(snippet.language);

  // Markdown-only toggle between the rendered preview and the raw source editor.
  const previewToggle = isMarkdown ? (
    <Tooltip
      content={showPreview ? editorCopy.editMarkdown : editorCopy.previewMarkdown}
      placement="bottom"
    >
      <button
        type="button"
        aria-label={showPreview ? editorCopy.editMarkdown : editorCopy.previewMarkdown}
        aria-pressed={showPreview}
        onClick={handleTogglePreview}
        className="flex items-center justify-center rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
      >
        {showPreview ? <Code2 size={13} /> : <Eye size={13} />}
      </button>
    </Tooltip>
  ) : null;

  const breadcrumbActions = readOnly ? (
    <>
      {previewToggle}
      <Tooltip content={editorCopy.copyCode} placement="bottom">
        <button
          type="button"
          aria-label={editorCopy.copyCode}
          onClick={handleCopy}
          className="flex items-center justify-center rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </Tooltip>
      {trashActions && (
        <>
          <div className="h-4 w-px bg-ink/[0.08]" />
          <Tooltip content={copy.trash.restore} placement="bottom">
            <button
              type="button"
              aria-label={copy.trash.restore}
              onClick={trashActions.onRestore}
              className="flex items-center justify-center rounded p-1.5 text-ink/45 transition-colors hover:bg-ink/[0.06] hover:text-ink/80"
            >
              <RotateCcw size={13} />
            </button>
          </Tooltip>
          <Tooltip content={copy.trash.deletePermanently} placement="bottom">
            <button
              type="button"
              aria-label={copy.trash.deletePermanently}
              onClick={trashActions.onDeletePermanently}
              className="flex items-center justify-center rounded p-1.5 text-danger transition-colors hover:bg-red-500/10 hover:text-danger-strong"
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </>
      )}
    </>
  ) : (
    <>
      <LanguageSelect
        value={snippet.language as LanguageId}
        onChange={(v) => onUpdate(snippet.id, { language: v })}
        copy={copy.languageSelect}
      />
      <div className="h-4 w-px bg-ink/[0.08]" />
      <Tooltip
        content={canFormat ? editorCopy.formatCode : editorCopy.formatNotSupported}
        placement="bottom"
      >
        <button
          type="button"
          aria-label={editorCopy.formatCode}
          onClick={handleFormat}
          disabled={!canFormat || formatting}
          className="flex items-center justify-center rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Zap size={13} className={formatting ? "animate-pulse" : undefined} />
        </button>
      </Tooltip>
      {previewToggle}
      <Tooltip content={editorCopy.copyCode} placement="bottom">
        <button
          type="button"
          aria-label={editorCopy.copyCode}
          onClick={handleCopy}
          className="flex items-center justify-center rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </Tooltip>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex h-full flex-col overflow-hidden focus:outline-none"
    >
      {/* The snippet's name lives in the (editable) breadcrumb crumb, so the
          view's heading is exposed to assistive tech only. */}
      <h1 className="sr-only">
        {snippet.title.trim() || editorCopy.titlePlaceholder}
      </h1>

      {/* ── Breadcrumb top bar ───────────────────────────────────────────── */}
      <Breadcrumbs
        items={breadcrumbItems}
        leading={menuButton}
        actions={breadcrumbActions}
        defaultStuck
        stackActionsOnMobile
      />

      {/* ── Trash notice ─────────────────────────────────────────────────── */}
      {readOnly && (
        <div className="flex items-center gap-2 border-b border-red-500/15 bg-red-500/[0.06] px-6 py-2 text-[12px] text-danger">
          <Trash2 size={13} className="shrink-0" />
          <span>{editorCopy.trashedNotice}</span>
        </div>
      )}

      {/* ── Source editor / Markdown WYSIWYG ───────────────────────────────── */}
      {isMarkdown ? (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {visited.preview && (
            <div className={`absolute inset-0 overflow-hidden${showPreview ? "" : " invisible"}`}>
              <MarkdownEditor
                value={code}
                onChange={handleCodeChange}
                editable={!readOnly}
                active={showPreview}
                defaultCodeLanguage={defaultCodeLanguage}
                copy={{
                  placeholder: editorCopy.mdPlaceholder,
                  linkDialog: editorCopy.linkDialog,
                  toolbar: editorCopy.mdToolbar,
                  slash: editorCopy.mdSlash,
                  table: editorCopy.mdTable,
                  codeBlock: {
                    copy: editorCopy.copyCode,
                    copied: editorCopy.codeCopied,
                    options: editorCopy.mdCodeBlockOptions,
                    format: editorCopy.formatCode,
                    delete: editorCopy.mdCodeBlockDelete,
                    formatError: editorCopy.formatError,
                  },
                  languageSelect: copy.languageSelect,
                }}
              />
            </div>
          )}
          {visited.source && (
            <div
              className={`absolute inset-0 overflow-hidden pl-6 [&>div]:h-full${showPreview ? " invisible" : ""}`}
            >
              <Editor
                value={showPreview ? sourceFreeze : code}
                onChange={handleCodeChange}
                language={snippet.language}
                readOnly={readOnly}
                height="100%"
                fontSize={14}
                gutterBackground="var(--background)"
                lineWrapping={codeWrap}
                ariaLabel={copy.forms.codeEditor}
                editorRef={sourceEditorRef}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden pl-6 [&>div]:h-full">
          <Editor
            value={code}
            onChange={handleCodeChange}
            language={snippet.language}
            readOnly={readOnly}
            height="100%"
            fontSize={14}
            gutterBackground="var(--background)"
            lineWrapping={codeWrap}
            ariaLabel={copy.forms.codeEditor}
          />
        </div>
      )}

      {/* ── Sync status — fixed bottom-right corner (hidden for trashed) ──── */}
      {!readOnly && (
        <div className="fixed bottom-4 right-4 z-50 rounded-full border border-ink/[0.08] bg-background/80 px-3 py-1.5 backdrop-blur-sm">
          <SyncIndicator status={syncStatus} copy={editorCopy} />
        </div>
      )}

      <FormatErrorToast nonce={formatErrorNonce} message={editorCopy.formatError} />
    </main>
  );
}
