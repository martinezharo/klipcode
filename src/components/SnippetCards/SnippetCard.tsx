"use client";

import { Check, Copy, Folder, Pin, PinOff } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { LANGUAGES } from "@/lib/constants/languages";
import type { Dictionary } from "@/i18n";
import type { SnippetRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

function getDisplayName(snippet: SnippetRecord, untitledLabel: string) {
  const extension = LANGUAGES.find((language) => language.id === snippet.language)?.extension ?? "";
  const baseName = snippet.title || untitledLabel;

  if (!extension || baseName.endsWith(extension)) {
    return baseName;
  }

  return `${baseName}${extension}`;
}

function buildPreviewLines(code: string) {
  const lines = code.split("\n").slice(0, 8);

  if (lines.length === 0) {
    return [""];
  }

  return lines.map((line) => (line.length > 92 ? `${line.slice(0, 92)}…` : line));
}

interface SnippetCardProps {
  snippet: SnippetRecord;
  folderName: string | null;
  copy: Dictionary;
  onSelect: () => void;
  onUnpinHome?: () => void;
  onTogglePinAside?: (pinned: boolean) => void;
  className?: string;
}

export function SnippetCard({ snippet, folderName, copy, onSelect, onUnpinHome, onTogglePinAside, className }: SnippetCardProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleUnpinHome = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onUnpinHome?.();
  };

  const handleTogglePinAside = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    onTogglePinAside?.(!snippet.isPinnedAside);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const displayName = getDisplayName(snippet, copy.snippetCard.untitled);
  const previewLines = buildPreviewLines(snippet.code);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface transition-colors hover:border-white/[0.12] hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:cursor-grabbing",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">
              {displayName}
            </h3>

            {folderName && (
              <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted">
                <Folder size={12} />
                <span className="truncate max-w-[100px]">{folderName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onTogglePinAside && (
            <button
              type="button"
              onClick={handleTogglePinAside}
              className={cn(
                "group/pin relative flex h-6 w-6 items-center justify-center rounded transition-opacity",
                snippet.isPinnedAside
                  ? "opacity-100 text-muted hover:bg-white/[0.08] hover:text-foreground"
                  : "opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/70 hover:bg-white/[0.08]",
              )}
              title={snippet.isPinnedAside ? copy.contextMenu.unpinAside : copy.contextMenu.pinAside}
              aria-label={snippet.isPinnedAside ? copy.contextMenu.unpinAside : copy.contextMenu.pinAside}
            >
              {snippet.isPinnedAside ? (
                <>
                  <Pin size={14} className="transition-opacity group-hover/pin:opacity-0" />
                  <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/pin:opacity-100" />
                </>
              ) : (
                <Pin size={14} className="opacity-70 group-hover:opacity-100" />
              )}
            </button>
          )}

          {onUnpinHome && snippet.isPinnedHome && (
            <button
              type="button"
              onClick={handleUnpinHome}
              className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-white/[0.08] hover:text-foreground"
              title={copy.contextMenu.unpinHome}
              aria-label={copy.contextMenu.unpinHome}
            >
              <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
              <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-white/[0.08] hover:text-foreground"
            title={copy.contextMenu.copyContent}
            aria-label={copy.contextMenu.copyContent}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden px-1 pb-1">
        <div className="max-h-[140px] overflow-hidden rounded-lg border border-white/[0.04] bg-[#0b0b0b] px-3 py-2 font-mono text-[12px] leading-5 text-white/90">
          <div className="pointer-events-none select-none text-white/40">
            {previewLines.map((line, index) => (
              <div key={`${snippet.id}-${index}`} className="flex gap-3">
                <span className="w-5 shrink-0 text-right tabular-nums text-white/25">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-pre">{line || " "}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-1 left-1 right-1 h-12 rounded-b-lg bg-gradient-to-t from-surface to-transparent group-hover:from-surface-hover" />
      </div>
    </article>
  );
}