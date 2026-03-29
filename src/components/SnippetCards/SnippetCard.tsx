"use client";

import { Check, Clipboard, Copy, Folder, MoreHorizontal, PenLine, Pin, PinOff, Scissors, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { LANGUAGES } from "@/lib/constants/languages";
import type { Dictionary } from "@/i18n";
import type { SnippetRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";

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
  onNavigateFolder?: () => void;
  onUnpinHome?: () => void;
  // Context-menu mode (replaces the old onTogglePinAside hover button)
  onPinAside?: (pinned: boolean) => void;
  onPinHome?: (pinned: boolean) => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  hasPaste?: boolean;
  className?: string;
}

export function SnippetCard({
  snippet,
  folderName,
  copy,
  onSelect,
  onNavigateFolder,
  onUnpinHome,
  onPinAside,
  onPinHome,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  hasPaste,
  className,
}: SnippetCardProps) {
  const [copied, setCopied] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMenu = !!(onPinAside || onPinHome || onRename || onDelete || onCut || onCopy);

  const cm = copy.contextMenu;

  const menuGroups: ContextMenuGroup[] = hasMenu
    ? [
        {
          items: [
            {
              id: "copy-content",
              label: cm.copyContent,
              Icon: Copy,
              onClick: () => void navigator.clipboard.writeText(snippet.code ?? ""),
            },
          ],
        },
        {
          items: [
            ...(onPinAside
              ? [
                  snippet.isPinnedAside
                    ? { id: "unpin-aside", label: cm.unpinAside, Icon: PinOff, onClick: () => onPinAside(false) }
                    : { id: "pin-aside", label: cm.pinAside, Icon: Pin, onClick: () => onPinAside(true) },
                ]
              : []),
            ...(onPinHome
              ? [
                  snippet.isPinnedHome
                    ? { id: "unpin-home", label: cm.unpinHome, Icon: PinOff, onClick: () => onPinHome(false) }
                    : { id: "pin-home", label: cm.pinHome, Icon: Pin, onClick: () => onPinHome(true) },
                ]
              : []),
            ...(onRename
              ? [
                  {
                    id: "rename",
                    label: cm.rename,
                    Icon: PenLine,
                    onClick: () => {
                      setRenameValue(snippet.title ?? "");
                      setIsRenaming(true);
                    },
                  },
                ]
              : []),
          ],
        },
        {
          items: [
            ...(onCut ? [{ id: "cut", label: cm.cut, Icon: Scissors, onClick: () => onCut() }] : []),
            ...(onCopy ? [{ id: "copy", label: cm.copy, Icon: Copy, onClick: () => onCopy() }] : []),
            ...(hasPaste && onPaste ? [{ id: "paste", label: cm.paste, Icon: Clipboard, onClick: () => onPaste() }] : []),
          ],
        },
        {
          items: onDelete
            ? [
                {
                  id: "delete",
                  label: cm.delete,
                  Icon: Trash2,
                  variant: "destructive" as const,
                  onClick: () => onDelete(),
                },
              ]
            : [],
        },
      ].filter((g) => g.items.length > 0)
    : [];

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

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const openMenuAt = (x: number, y: number) => setMenuAnchor({ x, y });

  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (menuAnchor) {
      setMenuAnchor(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!hasMenu) return;
    event.preventDefault();
    event.stopPropagation();
    openMenuAt(event.clientX, event.clientY);
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (name) onRename?.(name);
    setIsRenaming(false);
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
      onContextMenu={handleContextMenu}
      className={cn(
        "group flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface transition-colors hover:border-white/[0.12] hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:cursor-grabbing",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded bg-white/[0.07] px-2 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-medium text-foreground">
                {displayName}
              </h3>

              {folderName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateFolder?.();
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted transition-colors",
                    onNavigateFolder ? "hover:bg-white/[0.12] hover:text-foreground" : "cursor-default"
                  )}
                >
                  <Folder size={12} />
                  <span className="truncate max-w-[100px]">{folderName}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Context-menu mode */}
          {hasMenu && (
            <>
              {snippet.isPinnedAside && (
                <span className="flex h-6 w-6 items-center justify-center text-white/40">
                  <Pin size={14} />
                </span>
              )}
              <button
                type="button"
                onClick={handleMoreClick}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-muted transition-all hover:bg-white/[0.08] hover:text-foreground",
                  menuAnchor ? "opacity-100 bg-white/[0.08] text-foreground" : "opacity-100",
                )}
                title={cm.moreOptions}
                aria-label={cm.moreOptions}
              >
                <MoreHorizontal size={14} />
              </button>
            </>
          )}

          {/* Legacy unpin-home button (Home view, no menu mode) */}
          {!hasMenu && onUnpinHome && snippet.isPinnedHome && (
            <button
              type="button"
              onClick={handleUnpinHome}
              className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-white/[0.08] hover:text-foreground"
              title={cm.unpinHome}
              aria-label={cm.unpinHome}
            >
              <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
              <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-white/[0.08] hover:text-foreground"
            title={cm.copyContent}
            aria-label={cm.copyContent}
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

      {menuAnchor && menuGroups.length > 0 && (
        <ContextMenu
          x={menuAnchor.x}
          y={menuAnchor.y}
          groups={menuGroups}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </article>
  );
}