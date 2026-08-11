"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, MoreHorizontal, Pin } from "lucide-react";

import { sortByPinThenAlpha } from "@/components/Aside/utils";
import { TOUCH_TARGET } from "@/lib/constants/layout";
import type { FolderRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InlineNameInput } from "@/ui/InlineNameInput";

import { FeedCard } from "./FeedCard";
import { useFeedCtx } from "./FeedContext";

/**
 * A folder as a collapsible group header with its contents inline beneath it.
 *
 * The mobile home has no tree: a tree asks a finger to hit a 13px chevron to
 * reveal rows that then look nothing like the cards above them. A group header
 * is one full-width target that reveals the *same* card every other part of the
 * feed uses, so there is one row shape and one interaction to learn.
 *
 * Tapping the header expands it, because on this screen browsing is what a
 * folder is for. Opening the folder's own view — breadcrumbs, its card grid —
 * stays available from the row's actions menu.
 */
export function FolderGroup({ folder, depth }: { folder: FolderRecord; depth: number }) {
  const ctx = useFeedCtx();
  const [isOpen, setIsOpen] = useState(false);

  const isRenaming = ctx.renamingId === folder.id;
  const isCreatingHere = ctx.creatingFolderParentId === folder.id;

  const childFolders = sortByPinThenAlpha(
    ctx.foldersByParent.get(folder.id) ?? [],
    (f) => f.name,
  );
  const childSnippets = sortByPinThenAlpha(
    ctx.snippetsByFolder.get(folder.id) ?? [],
    (s) => s.title ?? "",
  );
  const childCount = childFolders.length + childSnippets.length;

  const prevCreating = useRef(false);
  useEffect(() => {
    // Creating a folder in here must reveal where it is being created.
    if (isCreatingHere && !prevCreating.current) setIsOpen(true);
    prevCreating.current = isCreatingHere;
  }, [isCreatingHere]);

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "folder", id: folder.id, x: rect.left, y: rect.bottom + 4 });
  }

  return (
    <section style={{ paddingLeft: depth * 12 }}>
      <div className="flex items-center gap-1">
        {isRenaming ? (
          <span className="flex h-11 min-w-0 flex-1 items-center gap-2 px-1">
            <Folder size={15} className="shrink-0 text-ink/40" />
            <InlineNameInput
              placeholder={folder.name}
              onSubmit={(name) => ctx.submitFolderRename(folder.id, name)}
              onCancel={ctx.cancelRename}
              className="min-w-0 flex-1 rounded-md bg-ink/[0.07] px-2 py-1.5 text-[13px] text-foreground outline-none ring-1 ring-ink/15 transition-shadow focus:ring-ink/35"
            />
          </span>
        ) : (
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left transition-colors active:bg-ink/6",
              ctx.selectedFolderId === folder.id && "text-foreground",
            )}
          >
            {isOpen ? (
              <ChevronDown size={15} className="shrink-0 text-ink/30" aria-hidden="true" />
            ) : (
              <ChevronRight size={15} className="shrink-0 text-ink/30" aria-hidden="true" />
            )}
            <Folder size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
            <span className="min-w-0 truncate text-[13px] font-medium uppercase tracking-[0.04em] text-muted">
              {folder.name}
            </span>
            {folder.isPinnedAside && (
              <>
                <Pin size={10} className="shrink-0 text-ink/30" aria-hidden="true" />
                <span className="sr-only">{ctx.copy.aside.pinned}</span>
              </>
            )}
            <span className="flex-1" />
            <span className="shrink-0 text-[11px] tabular-nums text-faint">{childCount}</span>
          </button>
        )}

        <button
          type="button"
          onClick={openMoreMenu}
          aria-label={ctx.copy.contextMenu.moreOptions}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/35 transition-colors active:bg-ink/8",
            TOUCH_TARGET,
          )}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {(isOpen || isCreatingHere) && (
        <div className="flex flex-col gap-2 pb-2">
          {isCreatingHere && (
            <NewFolderCard depth={depth + 1} parentId={folder.id} />
          )}
          {childFolders.map((child) => (
            <FolderGroup key={child.id} folder={child} depth={depth + 1} />
          ))}
          {childSnippets.map((snippet) => (
            <FeedCard
              key={snippet.id}
              snippet={snippet}
              copy={ctx.copy}
              // Inside its own folder the chip would say what the header above
              // already says.
              folderName={null}
              isActive={ctx.selectedSnippetId === snippet.id}
              isRenaming={ctx.renamingId === snippet.id}
              onOpen={() => ctx.openSnippet(snippet.id)}
              onMore={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                ctx.openMenu({ type: "snippet", id: snippet.id, x: rect.left, y: rect.bottom + 4 });
              }}
              onSubmitRename={(value) => ctx.submitSnippetRename(snippet.id, value)}
              onCancelRename={ctx.cancelRename}
            />
          ))}
          {childCount === 0 && !isCreatingHere && (
            <p className="px-1 pb-1 text-[12px] text-faint">{ctx.copy.folderView.emptyFolder}</p>
          )}
        </div>
      )}
    </section>
  );
}

/** The inline "name your new folder" row, styled to sit among the cards. */
export function NewFolderCard({
  depth,
  parentId,
}: {
  depth: number;
  parentId: string | null;
}) {
  const ctx = useFeedCtx();

  return (
    <div
      style={{ paddingLeft: depth * 12 }}
      className="flex h-11 items-center gap-2 px-1"
    >
      <Folder size={15} className="shrink-0 text-ink/40" />
      <InlineNameInput
        placeholder={ctx.copy.forms.folderName}
        onSubmit={(name) => ctx.submitCreateFolder(parentId, name)}
        onCancel={ctx.cancelCreateFolder}
        className="min-w-0 flex-1 rounded-md bg-ink/[0.07] px-2 py-1.5 text-[13px] text-foreground placeholder:text-faint outline-none ring-1 ring-ink/15 transition-shadow focus:ring-ink/35"
      />
    </div>
  );
}
