"use client";

import { useState, useRef } from "react";
import {
  Copy,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  CircleCheck,
  Pencil,
  FileCode2,
  Folder,
  Layers,
} from "lucide-react";

import { Editor } from "@/components/Editor/Editor";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/Breadcrumbs/Breadcrumbs";
import { LanguageSelect } from "@/ui/LanguageSelect";
import type { LanguageId } from "@/lib/constants/languages";
import type { SnippetRecord, FolderRecord, SyncStatus } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import { LANGUAGES } from "@/lib/constants/languages";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function buildFolderPath(folderId: string | null, folders: FolderRecord[]): FolderRecord[] {
  if (!folderId) return [];
  const path: FolderRecord[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    const parentId = current.parentId;
    current = parentId ? folders.find((f) => f.id === parentId) : undefined;
  }
  return path;
}

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
  onNavigateFolder?: (folderId: string) => void;
  onNavigateHome?: () => void;
  onUpdate: (snippetId: string, changes: { title?: string; code?: string; language?: LanguageId }) => void;
  menuButton?: React.ReactNode;
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
  menuButton,
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

  // ── Folder path for breadcrumb ───────────────────────────────────────────
  const folderPath = buildFolderPath(snippet.folderId, folders);

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      id: "root",
      label: copy.aside.mySpace,
      icon: <Layers size={12} aria-hidden="true" />,
      onClick: onNavigateHome ? onNavigateHome : onClose,
    },
    ...folderPath.map<BreadcrumbItem>((f) => ({
      id: f.id,
      label: f.name,
      icon: <Folder size={12} aria-hidden="true" />,
      onClick: onNavigateFolder ? () => onNavigateFolder(f.id) : onClose,
    })),
    {
      id: snippet.id,
      icon: <FileCode2 size={12} className="shrink-0 text-white/40" aria-hidden="true" />,
      label: (
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder={editorCopy.titlePlaceholder}
          className="w-full max-w-[240px] bg-transparent font-medium text-foreground placeholder:text-white/25 focus:outline-none"
          spellCheck={false}
        />
      ),
      // No onClick — editable title is the "current" item
    },
  ];

  const breadcrumbActions = (
    <>
      <LanguageSelect
        value={snippet.language as LanguageId}
        onChange={(v) => onUpdate(snippet.id, { language: v })}
        copy={copy.languageSelect}
      />
      <div className="h-4 w-px bg-white/[0.08]" />
      <button
        type="button"
        title={editorCopy.copyCode}
        onClick={handleCopy}
        className="flex items-center justify-center rounded p-1.5 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Breadcrumb top bar ───────────────────────────────────────────── */}
      <Breadcrumbs
        items={breadcrumbItems}
        leading={menuButton}
        actions={breadcrumbActions}
        defaultStuck
      />

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

      {/* ── Sync status — fixed bottom-right corner ───────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 rounded-full border border-white/[0.08] bg-[#0a0a0a]/80 px-3 py-1.5 backdrop-blur-sm">
        <SyncIndicator status={syncStatus} copy={editorCopy} />
      </div>
    </div>
  );
}
