"use client";

import { useState, useRef } from "react";
import {
  ArrowLeft,
  Folder,
  Copy,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  CircleCheck,
  Pencil,
} from "lucide-react";

import { Editor } from "@/components/Editor/Editor";
import type { SnippetRecord, FolderRecord, SyncStatus } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { LANGUAGES } from "@/lib/constants/languages";

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
        <span className={`${shared} text-white/40`}>
          <Pencil size={11} />
          {copy.syncEditing}
        </span>
      );
    case "saving":
      return (
        <span className={`${shared} text-white/40`}>
          <Loader2 size={11} className="animate-spin" />
          {copy.syncSaving}
        </span>
      );
    case "saved-local":
      return (
        <span className={`${shared} text-white/40`}>
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
        <span className={`${shared} text-red-400/80`}>
          <CloudOff size={11} />
          {copy.syncError}
        </span>
      );
    default:
      return (
        <span className={`${shared} text-white/20`}>
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
  onUpdate: (snippetId: string, changes: { title?: string; code?: string }) => void;
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
  onUpdate,
}: SnippetEditorProps) {
  const editorCopy = copy.snippetEditor;

  // Local state — initialised from snippet once (key={snippet.id} resets on swap)
  const [title, setTitle] = useState(snippet.title);
  const [code, setCode] = useState(snippet.code);
  const [copied, setCopied] = useState(false);

  // Per-field debounce timers
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const langConfig = LANGUAGES.find((l) => l.id === snippet.language);
  const folderName = snippet.folderId
    ? (folders.find((f) => f.id === snippet.folderId)?.name ?? editorCopy.folderRoot)
    : editorCopy.folderRoot;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setTitle(next);

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onUpdate(snippet.id, { title: next });
    }, 800);
  }

  function handleCodeChange(next: string) {
    setCode(next);

    if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    codeTimerRef.current = setTimeout(() => {
      onUpdate(snippet.id, { code: next });
    }, 800);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        {/* Back */}
        <button
          type="button"
          title={editorCopy.back}
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
        >
          <ArrowLeft size={13} />
          <span>{editorCopy.back}</span>
        </button>

        <div className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={editorCopy.titlePlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-white/25 focus:outline-none"
          spellCheck={false}
        />

        {/* Language badge */}
        {langConfig && (
          <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/50">
            {langConfig.label}
          </span>
        )}

        {/* Folder breadcrumb */}
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/30">
          <Folder size={11} />
          <span>{folderName}</span>
        </span>

        <div className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Sync status */}
        <SyncIndicator status={syncStatus} copy={editorCopy} />

        <div className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Copy button */}
        <button
          type="button"
          title={editorCopy.copyCode}
          onClick={handleCopy}
          className="flex shrink-0 items-center justify-center rounded p-1.5 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden pl-6 [&>div]:h-full">
        <Editor
          value={code}
          onChange={handleCodeChange}
          language={snippet.language}
          readOnly={false}
          height="100%"
          fontSize={14}
        />
      </div>
    </div>
  );
}
