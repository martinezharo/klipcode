"use client";

import { Check, Clipboard, Copy, ExternalLink, Folder, MoreHorizontal, PenLine, Pin, PinOff, RotateCcw, Scissors, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import type { Dictionary } from "@/i18n";
import type { SelectedItem, SnippetRecord } from "@/lib/types";
import { cn, getSnippetDisplayName, getSnippetFileName } from "@/lib/utils";
import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { suppressModifierDragStart } from "@/hooks/useMultiSelection";
import { LanguageIcon } from "@/ui/LanguageIcon";
import { Tooltip, TruncateTooltip } from "@/ui/Tooltip";
import { GeneratingTitle, useIsGeneratingTitle } from "@/components/TitleGeneration";
import { buildPreviewLines, useHighlightedPreview } from "./snippetPreview";

interface SnippetCardProps {
  snippet: SnippetRecord;
  folderName: string | null;
  copy: Dictionary;
  /** Click on the card/title. Receives the event so the parent can route
   *  ⌘/Ctrl/Shift+click to multi-selection instead of opening. */
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenInNewTab?: () => void;
  onNavigateFolder?: () => void;
  onUnpinHome?: () => void;
  onUnpinAside?: () => void;
  onPinAside?: (pinned: boolean) => void;
  onPinHome?: (pinned: boolean) => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  hasPaste?: boolean;
  className?: string;
  enableDrag?: boolean;
  /** Part of the parent view's multi-selection — renders highlighted. */
  selected?: boolean;
  /** When the card belongs to a multi-selection, the whole set to drag as a batch. */
  dragItems?: SelectedItem[];
  /** Called right before the context/"more" menu opens, so the parent can sync
   *  its multi-selection with the card the menu will act on. */
  onMenuOpen?: () => void;
  /** When set, the card renders in trash mode: the menu offers restore /
   *  delete-permanently instead of the normal actions, and it can be dragged onto
   *  the tree to restore. It stays clickable (opens read-only in the editor). */
  trashActions?: { onRestore: () => void; onDeletePermanently: () => void };
}

export function SnippetCard({
  snippet,
  folderName,
  copy,
  onSelect,
  onOpenInNewTab,
  onNavigateFolder,
  onUnpinHome,
  onUnpinAside,
  onPinAside,
  onPinHome,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onPaste,
  hasPaste,
  className,
  enableDrag,
  selected,
  dragItems,
  onMenuOpen,
  trashActions,
}: SnippetCardProps) {
  const [copied, setCopied] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTrash = !!trashActions;
  // Draggable when the page opts in (enableDrag) or when in the trash, where the
  // drag restores the snippet onto the tree. Inline rename temporarily disables
  // native drag so mouse gestures select text inside the input instead.
  const canDrag = (enableDrag || isTrash) && !isRenaming;

  const drag = useDragCtx();
  const isDraggingThis =
    canDrag &&
    drag.dragging !== null &&
    ((drag.dragging.id === snippet.id && drag.dragging.type === "snippet") ||
      Boolean(drag.dragging.items?.some((it) => it.id === snippet.id)));

  const cm = copy.contextMenu;
  const hasMenu = isTrash || !!(onOpenInNewTab || onPinAside || onPinHome || onRename || onDelete || onCut || onCopy);

  const menuGroups: ContextMenuGroup[] = isTrash
    ? [
        {
          items: [{
            id: "copy-content",
            label: cm.copyContent,
            Icon: Copy,
            onClick: () => void navigator.clipboard.writeText(snippet.code ?? ""),
          }],
        },
        { items: [{ id: "restore", label: cm.restore, Icon: RotateCcw, onClick: () => trashActions!.onRestore() }] },
        { items: [{ id: "delete-permanently", label: cm.deletePermanently, Icon: Trash2, variant: "destructive" as const, onClick: () => trashActions!.onDeletePermanently() }] },
      ]
    : hasMenu
    ? [
        {
          items: [
            ...(onOpenInNewTab
              ? [{ id: "open-in-new-tab", label: cm.openInNewTab, Icon: ExternalLink, onClick: () => onOpenInNewTab() }]
              : []),
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
                      setRenameValue(getSnippetFileName(snippet.title, snippet.language));
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

  const handleUnpinAside = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onUnpinAside?.();
  };

  const openMenuAt = (x: number, y: number) => setMenuAnchor({ x, y });

  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (menuAnchor) {
      setMenuAnchor(null);
      return;
    }
    onMenuOpen?.();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!hasMenu) return;
    event.preventDefault();
    event.stopPropagation();
    onMenuOpen?.();
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

  const displayName = getSnippetDisplayName(snippet.title, snippet.language, copy.snippetCard.untitled);
  const isGeneratingTitle = useIsGeneratingTitle(snippet.id);
  const previewLines = buildPreviewLines(snippet.code);
  // Syntax-highlighted preview when the language is supported; `null` while the
  // grammars load (or when unsupported), where we fall back to plain lines.
  const highlightedLines = useHighlightedPreview(snippet.code, snippet.language);

  return (
    <article
      data-snippet-card=""
      data-selectable-id={snippet.id}
      data-selectable-type="snippet"
      draggable={canDrag}
      onContextMenu={handleContextMenu}
      onDragStart={canDrag ? (e) => {
        if (suppressModifierDragStart(e)) return;
        drag.startDrag("snippet", snippet.id, isTrash ? "trash" : "workspace", dragItems);
        e.dataTransfer.effectAllowed = "move";
      } : undefined}
      onDragEnd={canDrag ? () => drag.endDrag() : undefined}
      className={cn(
        "group relative flex w-72 shrink-0 select-none flex-col overflow-hidden rounded-xl border bg-surface transition-colors hover:bg-surface-hover has-[[data-card-open]:focus-visible]:ring-2 has-[[data-card-open]:focus-visible]:ring-ink/20 cursor-pointer",
        selected
          ? "border-ink/30 bg-ink/[0.05]"
          : "border-ink/[0.06] hover:border-ink/[0.12]",
        canDrag && (isDraggingThis ? "opacity-40 cursor-grabbing" : "active:cursor-grabbing"),
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <LanguageIcon language={snippet.language} size={15} className="shrink-0" />
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
              className="min-w-0 flex-1 select-text rounded bg-ink/[0.07] px-2 py-0.5 text-sm font-medium text-foreground outline-none ring-1 ring-ink/15 focus:ring-ink/35 transition-shadow"
            />
          ) : (
            <button
              type="button"
              data-card-open=""
              onClick={onSelect}
              aria-label={isGeneratingTitle ? copy.snippetCard.generatingTitle : displayName}
              className="min-w-0 flex-1 text-left outline-none focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {isGeneratingTitle ? (
                <GeneratingTitle
                  label={copy.snippetCard.generatingTitle}
                  className="relative z-10 text-sm font-medium"
                />
              ) : (
                <TruncateTooltip text={displayName} className="relative z-10 block truncate text-sm font-medium text-foreground" placement="bottom" />
              )}
            </button>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-1">
          {/* Unpin-from-home button (home view) */}
          {onUnpinHome && snippet.isPinnedHome && (
            <Tooltip content={cm.unpinHome} placement="bottom">
              <button
                type="button"
                onClick={handleUnpinHome}
                className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-ink/[0.08] hover:text-foreground"
                aria-label={cm.unpinHome}
              >
                <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
                <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
              </button>
            </Tooltip>
          )}

          {/* Unpin-from-aside button (folder view) */}
          {onUnpinAside && snippet.isPinnedAside && (
            <Tooltip content={cm.unpinAside} placement="bottom">
              <button
                type="button"
                onClick={handleUnpinAside}
                className="group/unpin relative flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-ink/[0.08] hover:text-foreground"
                aria-label={cm.unpinAside}
              >
                <Pin size={14} className="transition-opacity group-hover/unpin:opacity-0" />
                <PinOff size={14} className="absolute opacity-0 transition-opacity group-hover/unpin:opacity-100" />
              </button>
            </Tooltip>
          )}

          {/* Three-dot context menu button */}
          {hasMenu && (
            <Tooltip content={cm.moreOptions} placement="bottom">
              <button
                type="button"
                onClick={handleMoreClick}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-muted transition-all hover:bg-ink/[0.08] hover:text-foreground",
                  menuAnchor ? "opacity-100 bg-ink/[0.08] text-foreground" : "opacity-100",
                )}
                aria-label={cm.moreOptions}
              >
                <MoreHorizontal size={14} />
              </button>
            </Tooltip>
          )}

          <Tooltip content={cm.copyContent} placement="bottom">
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-100 hover:bg-ink/[0.08] hover:text-foreground"
              aria-label={cm.copyContent}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="pointer-events-none relative overflow-hidden px-1 pb-1">
        <div className="max-h-[140px] overflow-hidden rounded-lg border border-ink/[0.04] klipcode-code-surface px-3 py-2 font-mono text-[12px] leading-5 text-ink/90">
          <div
            className={cn(
              "pointer-events-none select-none text-ink/75",
              // Reuse the Markdown editor's hljs token colors, kept slightly
              // muted so the preview keeps its subdued, faded look.
              highlightedLines && "klipcode-code-preview",
            )}
          >
            {previewLines.map((line, index) => {
              const highlighted = highlightedLines?.[index];
              return (
                <div key={`${snippet.id}-${index}`} className="flex gap-3">
                  <span className="w-5 shrink-0 text-right tabular-nums text-faint">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate whitespace-pre">
                    {highlighted && highlighted.length > 0 ? highlighted : line || " "}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-1 left-1 right-1 h-12 rounded-b-lg bg-gradient-to-t from-surface to-transparent group-hover:from-surface-hover" />
      </div>

      {folderName && (
        <div className="pointer-events-none relative z-10 mt-auto flex justify-end px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateFolder?.();
            }}
            className={cn(
              "pointer-events-auto flex items-center gap-1.5 rounded-md border border-ink/[0.05] bg-ink/[0.02] px-2 py-1 text-[11px] font-medium text-muted transition-all",
              onNavigateFolder ? "hover:border-ink/[0.1] hover:bg-ink/[0.06] hover:text-foreground" : "cursor-default",
            )}
          >
            <Folder size={12} />
            <span className="max-w-[120px] truncate">{folderName}</span>
          </button>
        </div>
      )}

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
