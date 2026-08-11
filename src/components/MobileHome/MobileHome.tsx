"use client";

import { useId, useMemo, useState } from "react";
import Image from "next/image";
import {
  FilePlus,
  FolderOpen,
  LogIn,
  LogOut,
  MoreHorizontal,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  User,
} from "lucide-react";

import { ContextMenu, type ContextMenuGroup } from "@/components/ContextMenu/ContextMenu";
import type { MenuTarget } from "@/components/Aside/types";
import { useContextMenuGroups } from "@/components/Aside/useContextMenuGroups";
import { sortByPinThenAlpha } from "@/components/Aside/utils";
import { TOUCH_TARGET } from "@/lib/constants/layout";
import { cn } from "@/lib/utils";
import { Spinner } from "@/ui/Spinner";

import { FeedCard } from "./FeedCard";
import { FeedCtx, type FeedCtxShape } from "./FeedContext";
import { FeedTabs } from "./FeedTabs";
import { FolderGroup, NewFolderCard } from "./FolderGroup";
import { orderRecentSnippets } from "./ordering";
import type { MobileHomeProps } from "./types";

/** The mobile home is one list; the tabs only change what fills it. */
type FeedTab = "recent" | "space";

/**
 * The workspace as a full-screen destination, for touch layouts.
 *
 * This is a feed, not a tree. The screen used to be split between a horizontal
 * strip of near-empty teasers and a vertical tree of 13px rows: two scroll
 * directions, two densities, two visual languages, and neither of them showed
 * what a snippet actually contained. Here there is one card — filename,
 * language, two lines of real code, copy — and the tabs decide whether the list
 * is ordered by recency or by folder structure. Switching tabs never changes
 * what a row looks like or how it behaves.
 *
 * Deliberately absent: drag & drop and multi-selection. Both are pointer
 * gestures (HTML5 drag, ⌘/Shift-click) that no finger can perform, so the tree's
 * machinery for them bought this screen nothing. Everything else a row can do
 * still comes from the shared {@link useContextMenuGroups} builder, so the two
 * shells can never drift on what "delete" or "pin" means.
 */
export function MobileHome({
  user,
  authReady,
  copy,
  folders,
  snippets,
  onOpenSearch,
  onOpenPreferences,
  onSignIn,
  onSignOut,
  signingIn,
  signingOut,
  onOpenTrash,
  onRestoreAll,
  onEmptyTrash,
  trashCount,
  ...tree
}: MobileHomeProps) {
  const [tab, setTab] = useState<FeedTab>("recent");
  const [accountMenu, setAccountMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    string | null | undefined
  >(undefined);

  const tabsId = useId();
  const panelId = `${tabsId}-panel`;

  /* ── Data shaping ──────────────────────────────────────────────────────── */

  const foldersByParent = useMemo(() => {
    const index = new Map<string, typeof folders>();
    for (const folder of folders) {
      if (folder.parentId === null) continue;
      const children = index.get(folder.parentId) ?? [];
      children.push(folder);
      index.set(folder.parentId, children);
    }
    return index;
  }, [folders]);

  const snippetsByFolder = useMemo(() => {
    const index = new Map<string, typeof snippets>();
    for (const snippet of snippets) {
      if (snippet.folderId === null) continue;
      const children = index.get(snippet.folderId) ?? [];
      children.push(snippet);
      index.set(snippet.folderId, children);
    }
    return index;
  }, [snippets]);

  const folderNames = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const recents = useMemo(() => orderRecentSnippets(snippets), [snippets]);
  const rootFolders = sortByPinThenAlpha(
    folders.filter((f) => f.parentId === null),
    (f) => f.name,
  );
  const rootSnippets = sortByPinThenAlpha(
    snippets.filter((s) => s.folderId === null),
    (s) => s.title ?? "",
  );
  const isSpaceEmpty = rootFolders.length === 0 && rootSnippets.length === 0;

  /* ── Actions ───────────────────────────────────────────────────────────── */

  /**
   * Creating a folder has to be visible to be understood, and the inline field
   * only exists in the structure tab — so asking for one from anywhere switches
   * to it first.
   */
  function beginCreateFolder(parentId: string | null) {
    setTab("space");
    setCreatingFolderParentId(parentId);
  }

  // The mobile feed has no multi-selection, so every menu acts on the one row it
  // was opened from; the shared builder's batch branches simply never engage.
  const buildMenuGroups = useContextMenuGroups({
    ...tree,
    folders,
    snippets,
    copy,
    setRenamingId,
    setCreatingFolderParentId: (id) => beginCreateFolder(id ?? null),
    selectedIds: EMPTY_SELECTION,
    getSelectedItems: () => [],
    clearSelection: () => {},
  });

  /** The trash, plus the bulk actions that only make sense with something in it. */
  function trashGroups(): ContextMenuGroup[] {
    const entry: ContextMenuGroup = {
      items: [
        {
          id: "trash",
          label: trashCount > 0 ? `${copy.aside.trash} (${trashCount})` : copy.aside.trash,
          Icon: Trash2,
          onClick: onOpenTrash,
        },
      ],
    };
    if (trashCount === 0) return [entry];
    return [
      entry,
      {
        items: [
          {
            id: "restore-all",
            label: copy.trash.restoreAll,
            Icon: RotateCcw,
            onClick: onRestoreAll,
          },
          {
            id: "empty-trash",
            label: copy.trash.emptyTrash,
            Icon: Trash2,
            variant: "destructive",
            onClick: onEmptyTrash,
          },
        ],
      },
    ];
  }

  /**
   * The shared menus, plus the entries the desktop tree doesn't need.
   *
   * On the root: the desktop reaches the trash from the aside's own rail, which
   * touch layouts never render, so the header's ⋯ has to carry it. It belongs
   * here rather than under the avatar — the trash holds workspace content, not
   * account settings. Composed at this level on purpose: `buildMenuGroups` is
   * shared with the desktop, where the root menu is the right-click menu of the
   * tree's empty space and has no business offering the trash.
   *
   * On a folder: the desktop tree opens a folder by tapping the row and expands
   * it with the chevron. Here the header is the expander, so the folder view
   * needs its own way in.
   */
  function menuGroupsFor(target: MenuTarget) {
    const groups = buildMenuGroups(target);
    if (target.type === "root") return [...groups, ...trashGroups()];
    if (target.type !== "folder" || !target.id) return groups;
    const folderId = target.id;
    return [
      {
        items: [
          {
            id: "open-folder",
            label: copy.forms.open,
            Icon: FolderOpen,
            onClick: () => tree.onSelectFolder?.(folderId),
          },
        ],
      },
      ...groups,
    ];
  }

  const ctxValue: FeedCtxShape = {
    copy,
    foldersByParent,
    snippetsByFolder,
    renamingId,
    creatingFolderParentId,
    selectedSnippetId: tree.selectedSnippetId,
    selectedFolderId: tree.selectedFolderId,
    openSnippet: tree.onSelectSnippet,
    openFolder: (id) => tree.onSelectFolder?.(id),
    openMenu: setMenuTarget,
    submitFolderRename: (id, value) => {
      const name = value.trim();
      if (name) void tree.onRenameFolder(id, name);
      setRenamingId(null);
    },
    submitSnippetRename: (id, value) => {
      const title = value.trim();
      if (title) void tree.onRenameSnippet(id, title);
      setRenamingId(null);
    },
    cancelRename: () => setRenamingId(null),
    submitCreateFolder: (parentId, name) => {
      void tree.onCreateFolder(parentId, name);
      setCreatingFolderParentId(undefined);
    },
    cancelCreateFolder: () => setCreatingFolderParentId(undefined),
  };

  const accountLabel = user
    ? (user.name ?? user.email ?? copy.auth.signOut)
    : signingIn
      ? copy.auth.signingIn
      : copy.auth.signIn;

  function openAccountMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setAccountMenu({ x: rect.left, y: rect.bottom + 6 });
  }

  function openRootMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Right-aligned controls open menus that would otherwise run off-screen;
    // ContextMenu flips it back inside, but anchoring at the right edge keeps
    // the menu visually attached to the button that opened it.
    setMenuTarget({ type: "root", x: rect.right, y: rect.bottom + 6 });
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <FeedCtx.Provider value={ctxValue}>
      {accountMenu && (
        <ContextMenu
          x={accountMenu.x}
          y={accountMenu.y}
          groups={[
            {
              items: [
                {
                  id: "preferences",
                  label: copy.aside.preferences,
                  Icon: Settings,
                  onClick: onOpenPreferences,
                },
              ],
            },
            {
              items: user
                ? [
                    {
                      id: "sign-out",
                      label: signingOut ? copy.auth.signingOut : copy.auth.signOut,
                      Icon: LogOut,
                      onClick: onSignOut,
                      disabled: signingOut,
                    },
                  ]
                : [
                    {
                      id: "sign-in",
                      label: signingIn ? copy.auth.signingIn : copy.auth.signIn,
                      Icon: LogIn,
                      onClick: onSignIn,
                      disabled: signingIn,
                    },
                  ],
            },
          ]}
          onClose={() => setAccountMenu(null)}
        />
      )}

      {menuTarget && (
        <ContextMenu
          x={menuTarget.x}
          y={menuTarget.y}
          groups={menuGroupsFor(menuTarget)}
          onClose={() => setMenuTarget(null)}
        />
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex h-dvh flex-col overflow-hidden bg-background focus:outline-none"
      >
        {/* ── Identity ── */}
        <header className="flex shrink-0 items-center gap-2.5 px-4 pb-1 pt-3">
          <button
            type="button"
            onClick={openAccountMenu}
            aria-haspopup="menu"
            aria-expanded={accountMenu !== null}
            aria-label={accountLabel}
            className={cn("flex items-center justify-center rounded-full", TOUCH_TARGET)}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full",
                /* The filled disc reads as "an identity lives here". Signed out
                   there is none, so the button sheds the avatar chrome and sits
                   as a sibling of the icons to its right. */
                !authReady || user ? "bg-ink/8 ring-1 ring-ink/10" : "text-ink/45",
              )}
            >
              {!authReady ? (
                <span aria-hidden="true" className="h-full w-full animate-pulse bg-ink/10" />
              ) : signingIn || signingOut ? (
                <Spinner size={13} />
              ) : !user ? (
                <User size={18} />
              ) : user.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* An account can have no avatar (GitHub allows it) — fall back
                   to an initial rather than rendering a broken image. */
                <span aria-hidden="true" className="text-[11px] font-medium text-ink/45">
                  {(user.name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {copy.aside.mySpace}
            </h1>
            <p className="truncate text-[11.5px] leading-tight text-faint">
              {copy.folderView.snippetCount(snippets.length)}
            </p>
          </div>

          {/* 32px boxes 12px apart: their invisible 44px targets tile instead of
              overlapping (see TOUCH_TARGET). */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label={copy.aside.search}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-ink/45 transition-colors active:bg-ink/8",
                TOUCH_TARGET,
              )}
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              onClick={openRootMenu}
              aria-haspopup="menu"
              aria-label={copy.contextMenu.moreOptions}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-ink/45 transition-colors active:bg-ink/8",
                TOUCH_TARGET,
              )}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        {/* ── What fills the list ── */}
        <div className="shrink-0 px-4 py-2.5">
          <FeedTabs
            tabs={[
              { id: "recent", domId: `${tabsId}-recent`, label: copy.mobileHome.recent },
              { id: "space", domId: `${tabsId}-space`, label: copy.aside.mySpace },
            ]}
            active={tab}
            panelId={panelId}
            onSelect={setTab}
          />
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${tabsId}-${tab}`}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-28"
        >
          {tab === "recent" ? (
            recents.length === 0 ? (
              <p className="px-1 pt-2 text-[13px] text-faint">{copy.recentSnippets.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recents.map((snippet) => (
                  <li key={snippet.id}>
                    <FeedCard
                      snippet={snippet}
                      copy={copy}
                      folderName={
                        snippet.folderId ? (folderNames.get(snippet.folderId) ?? null) : null
                      }
                      isActive={tree.selectedSnippetId === snippet.id}
                      isRenaming={renamingId === snippet.id}
                      onOpen={() => tree.onSelectSnippet(snippet.id)}
                      onMore={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuTarget({
                          type: "snippet",
                          id: snippet.id,
                          x: rect.left,
                          y: rect.bottom + 4,
                        });
                      }}
                      onSubmitRename={(value) => ctxValue.submitSnippetRename(snippet.id, value)}
                      onCancelRename={ctxValue.cancelRename}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-1">
              {creatingFolderParentId === null && <NewFolderCard depth={0} parentId={null} />}

              {isSpaceEmpty && creatingFolderParentId === undefined ? (
                <p className="px-1 pt-2 text-[13px] text-faint">{copy.aside.emptySpace}</p>
              ) : (
                <>
                  {rootFolders.map((folder) => (
                    <FolderGroup key={folder.id} folder={folder} depth={0} />
                  ))}
                  <ul className="mt-1 flex flex-col gap-2">
                    {rootSnippets.map((snippet) => (
                      <li key={snippet.id}>
                        <FeedCard
                          snippet={snippet}
                          copy={copy}
                          folderName={null}
                          isActive={tree.selectedSnippetId === snippet.id}
                          isRenaming={renamingId === snippet.id}
                          onOpen={() => tree.onSelectSnippet(snippet.id)}
                          onMore={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMenuTarget({
                              type: "snippet",
                              id: snippet.id,
                              x: rect.left,
                              y: rect.bottom + 4,
                            });
                          }}
                          onSubmitRename={(value) =>
                            ctxValue.submitSnippetRename(snippet.id, value)
                          }
                          onCancelRename={ctxValue.cancelRename}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Creation is the only action anchored to the thumb, so it gets to be a
            target instead of sharing a bar with a search field.

            Icon-only, and a circle rather than a lozenge: labelled, it was a
            white pill with dark text inside — the same thing the tab switcher's
            active segment is — and the two rhymed across the screen at nearly
            equal area. Dropping the label breaks the rhyme and leaves the one
            solid shape that reads as "the primary action here". */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => tree.onOpenCreateModal(null)}
            aria-label={copy.aside.addSnippet}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-xl shadow-ink/20 transition-opacity active:opacity-85"
          >
            <FilePlus size={22} aria-hidden="true" />
          </button>
        </div>
      </main>
    </FeedCtx.Provider>
  );
}

/** No multi-selection on touch — a stable identity keeps the menu builder's deps quiet. */
const EMPTY_SELECTION: ReadonlySet<string> = new Set();
