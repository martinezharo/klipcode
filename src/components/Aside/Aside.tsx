"use client";

import { useRef, useState } from "react";
import { ChevronRight, Home, Keyboard, RotateCcw, Search, Settings, Trash2 } from "lucide-react";

import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { useDragCtx } from "@/components/DragContext";
import { WorkspaceTree } from "@/components/Workspace/WorkspaceTree";
import { ShortcutHint } from "@/ui/ShortcutHint";
import { Tooltip } from "@/ui/Tooltip";

import type { AsideProps } from "./types";
import { AsideHeader } from "./AsideHeader";
import { AsideResizeHandle } from "./AsideResizeHandle";
import { GitHubIcon } from "./GitHubIcon";

export type { AsideProps } from "./types";

/**
 * The desktop workspace panel.
 *
 * Below `lg` this is not rendered at all — `MobileHome` takes over, because the
 * tree is a destination on touch rather than a drawer over the canvas. The tree
 * itself lives in {@link WorkspaceTree} and is shared by both.
 */
export function Aside({
  user,
  authReady,
  copy,
  onGoHome,
  onOpenSearch,
  onOpenShortcuts,
  onOpenPreferences,
  onSignIn,
  onSignOut,
  signingIn,
  signingOut,
  onOpenTrash,
  onRestoreAll,
  onEmptyTrash,
  trashCount,
  isOpen,
  onSetOpen,
  onSetWidth,
  ...treeProps
}: AsideProps) {
  const [trashMenu, setTrashMenu] = useState<{ x: number; y: number } | null>(null);
  const [collapsePreview, setCollapsePreview] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const drag = useDragCtx();

  return (
    <>
      {trashMenu && (
        <ContextMenu
          x={trashMenu.x}
          y={trashMenu.y}
          groups={[
            {
              items: [
                {
                  id: "restore-all",
                  label: copy.trash.restoreAll,
                  Icon: RotateCcw,
                  onClick: onRestoreAll,
                },
              ],
            },
            {
              items: [
                {
                  id: "empty-trash",
                  label: copy.trash.emptyTrash,
                  Icon: Trash2,
                  variant: "destructive" as const,
                  onClick: onEmptyTrash,
                },
              ],
            },
          ]}
          onClose={() => setTrashMenu(null)}
        />
      )}

      <div
        ref={shellRef}
        // Collapsed, the panel is only clipped to zero width — its tree, its
        // account controls and its footer links are all still in the document.
        // `inert` takes the whole subtree out of the tab order and off the
        // accessibility tree, so a keyboard or screen-reader user isn't walked
        // through a panel nobody can see.
        inert={!isOpen}
        className={`klipcode-aside-shell overflow-hidden transition-[width] duration-300 ease-in-out${
          isOpen ? " w-[var(--aside-w)]" : " w-0"
        }`}
      >
        <aside
          id="klipcode-aside"
          aria-label={copy.aside.mySpace}
          className="relative flex h-dvh w-[var(--aside-w)] shrink-0 flex-col border-r border-ink/6 bg-surface"
        >
          {/* Only while open: collapsed, the panel is clipped to zero width and a
              focusable handle inside it would be a tab stop pointing at nothing. */}
          {isOpen && (
            <AsideResizeHandle
              copy={copy}
              shellRef={shellRef}
              onCollapsePreviewChange={setCollapsePreview}
              onCommit={onSetWidth}
              onCollapse={() => onSetOpen(false)}
            />
          )}

          <AsideHeader
            user={user}
            authReady={authReady}
            copy={copy}
            signingIn={signingIn}
            signingOut={signingOut}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
            onCollapse={() => onSetOpen(false)}
          />

          <div className="mx-4 mb-2 border-t border-ink/5" />

          {/* Home + Search */}
          <div className="px-2">
            <button
              type="button"
              onClick={onGoHome}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <Home size={14} className="shrink-0" />
              <span>{copy.aside.home}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Search size={14} className="shrink-0" />
                <span>{copy.aside.search}</span>
              </span>
              <ShortcutHint id="search" />
            </button>
          </div>

          <div className="mx-4 my-3 border-t border-ink/5" />

          <WorkspaceTree copy={copy} {...treeProps} />

          <div className="shrink-0 px-2 pb-4 pt-2">
            <button
              type="button"
              onClick={onOpenTrash}
              onContextMenu={(e) => {
                e.preventDefault();
                setTrashMenu({ x: e.clientX, y: e.clientY });
              }}
              onDragOver={(e) => {
                // dragover fires continuously while the cursor is over the button,
                // so it's the source of truth for the hover state — no child
                // enter/leave flicker (children are pointer-events-none anyway).
                if (drag.dragging?.origin !== "workspace") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (drag.dragOverId !== "trash-button") drag.enterDropTarget("trash-button");
              }}
              onDragLeave={(e) => {
                // Only clear when the cursor truly leaves the button (relatedTarget
                // outside it), and only if we're still the active target so we don't
                // clobber a sibling target that just took over.
                if (
                  drag.dragOverId === "trash-button" &&
                  !e.currentTarget.contains(e.relatedTarget as Node | null)
                ) {
                  drag.clearDropTarget();
                }
              }}
              onDrop={(e) => {
                if (drag.dragging?.origin !== "workspace") return;
                e.preventDefault();
                drag.dropOnTrash();
              }}
              className={[
                // Always carry a 1px (transparent) border so toggling to the
                // dashed drop-zone border only changes color, never width — an
                // animated 0→1px width renders dashes as a solid line mid-tween.
                "mb-1 flex w-full items-center rounded-md border border-transparent px-3 py-2 transition-colors duration-150",
                drag.dragging?.origin === "workspace"
                  ? "justify-center gap-1.5 border-dashed text-[11px] select-none " +
                    (drag.dragOverId === "trash-button"
                      ? "border-red-500/50 bg-red-500/10 text-danger-strong"
                      : "border-ink/10 text-faint")
                  : "gap-2 text-[13px] text-muted hover:bg-ink/4 hover:text-foreground",
              ].join(" ")}
            >
              {drag.dragging?.origin === "workspace" ? (
                <>
                  <Trash2 size={12} className="pointer-events-none shrink-0" />
                  <span className="pointer-events-none">{copy.aside.dropToTrash}</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} className="pointer-events-none shrink-0" />
                  <span className="pointer-events-none flex-1 text-left">{copy.aside.trash}</span>
                  {trashCount > 0 && (
                    <span className="pointer-events-none shrink-0 rounded-full bg-ink/8 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink/45">
                      {trashCount}
                    </span>
                  )}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <Settings size={14} className="shrink-0" />
              <span className="flex-1 text-left">{copy.aside.preferences}</span>
            </button>
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-ink/4 hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Keyboard size={14} className="shrink-0" />
                <span>{copy.aside.shortcuts}</span>
              </span>
              <ShortcutHint id="help" />
            </button>
            <a
              href="https://github.com/martinezharo/klipcode"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center justify-center py-2 px-3 gap-2 rounded-md border border-ink/4 bg-ink/1 text-[12px] font-medium text-ink/65 shadow-sm transition-all duration-300 hover:border-ink/10 hover:bg-ink/4 hover:text-ink"
            >
              <GitHubIcon
                size={14}
                className="shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:text-ink"
              />
              <span className="truncate tracking-wide">martinezharo/klipcode</span>
            </a>
          </div>
        </aside>
      </div>

      {(collapsePreview || !isOpen) && (
        <Tooltip content={copy.aside.open} placement="right" delay={250}>
          <button
            type="button"
            data-sidebar-toggle={collapsePreview ? undefined : "open"}
            data-aside-recovery
            aria-label={copy.aside.open}
            aria-hidden={collapsePreview}
            tabIndex={collapsePreview ? -1 : 0}
            onClick={collapsePreview ? undefined : () => onSetOpen(true)}
            className="klipcode-aside-recovery klipcode-z-tooltip fixed left-0 top-1/2 flex h-14 w-7 items-center justify-center rounded-r-lg border border-l-0 border-ink/10 bg-surface/95 text-ink/55 shadow-[4px_0_18px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-colors hover:border-ink/20 hover:bg-surface-hover hover:text-foreground"
          >
            <span className="flex h-7 w-3 items-center justify-center rounded-full bg-ink/6">
              <ChevronRight size={13} strokeWidth={2.25} aria-hidden="true" />
            </span>
          </button>
        </Tooltip>
      )}
    </>
  );
}
