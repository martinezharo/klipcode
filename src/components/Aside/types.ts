import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AccountUser, FolderRecord, SelectedItem } from "@/lib/types";
import type { Dictionary } from "@/i18n";
import type { WorkspaceTreeProps } from "@/components/Workspace/types";

/* ─────────────────────────── Props ─────────────────────────────────────── */

/**
 * Chrome shared by both workspace shells: the account controls plus the trash
 * entry point. `AsideProps` and `MobileHomeProps` are this and the tree's own
 * props, so neither shell has to restate the tree's twenty callbacks.
 */
export interface WorkspaceShellProps extends WorkspaceTreeProps {
  user: AccountUser | null;
  /** False until the initial session check resolves — while false the
   *  header shows a placeholder instead of flashing the signed-out button. */
  authReady: boolean;
  onOpenSearch: () => void;
  onOpenPreferences: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  /** Sign-in is redirecting to GitHub. */
  signingIn: boolean;
  /** Sign-out is clearing the session and local data. */
  signingOut: boolean;
  /** Open the trash view. */
  onOpenTrash: () => void;
  /** Restore every trashed record (no confirmation — non-destructive). */
  onRestoreAll: () => void;
  /** Permanently empty the trash (opens a confirmation dialog). */
  onEmptyTrash: () => void;
  /** Number of items currently in the trash, for the trash badge. */
  trashCount: number;
}

export interface AsideProps extends WorkspaceShellProps {
  onGoHome: () => void;
  onOpenShortcuts: () => void;
  isOpen: boolean;
  onSetOpen: (open: boolean) => void;
}

/* ─────────────────────────── Internal types ─────────────────────────────── */

export interface MenuTarget {
  type: "folder" | "snippet" | "root";
  id?: string;
  x: number;
  y: number;
}

export interface AsideCtxShape {
  copy: Dictionary;
  renamingId: string | null;
  /** undefined = inactive, null = creating at root, string = inside that folder id */
  creatingFolderParentId: string | null | undefined;
  openMenu: (target: MenuTarget) => void;
  beginRename: (id: string) => void;
  submitFolderRename: (id: string, value: string) => void;
  submitSnippetRename: (id: string, value: string) => void;
  cancelRename: () => void;
  beginCreateFolder: (parentId: string | null) => void;
  cancelCreateFolder: () => void;
  submitCreateFolder: (parentId: string | null, name: string) => void;
  selectSnippet: (id: string) => void;
  selectFolder: (id: string) => void;
  /** Click/keyboard activation of a tree row, resolving Shift/⌘/Ctrl modifiers
   *  into the right multi-selection behaviour. */
  activateItem: (e: ReactMouseEvent | ReactKeyboardEvent, item: SelectedItem) => void;
  /** Whether a row is part of the current multi-selection. */
  isItemSelected: (id: string) => boolean;
  /** Prime the selection before opening a row's context / "more" menu so its
   *  batch actions cover the right set (keep multi-selection if the row is in it,
   *  otherwise collapse to just that row). */
  selectForMenu: (id: string) => void;
  /** Whether a row is currently being dragged (single or as part of a batch). */
  isDraggingItem: (id: string) => boolean;
  /** Id of the snippet currently open in the main view, for highlighting. */
  selectedSnippetId: string | null;
  /** Id of the folder currently open in the main view, for highlighting. */
  selectedFolderId: string | null;
  pinFolder: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  pinSnippet: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  /* ── Drag & Drop ── */
  dragging: { type: "folder" | "snippet"; id: string } | null;
  dragOverId: string | null;
  startDrag: (type: "folder" | "snippet", id: string) => void;
  endDrag: () => void;
  enterDropTarget: (id: string) => void;
  dropOnTarget: (targetFolderId: string | null) => void;
  canDropOnFolder: (folderId: string) => boolean;
  folders: FolderRecord[];
}
