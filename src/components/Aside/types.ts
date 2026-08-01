import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type {
  AccountUser,
  ClipboardEntry,
  FolderRecord,
  SelectedItem,
  SnippetRecord,
} from "@/lib/types";
import type { Dictionary } from "@/i18n";

/* ─────────────────────────── Props ─────────────────────────────────────── */

export interface AsideProps {
  user: AccountUser | null;
  /** False until the initial session check resolves — while false the
   *  header shows a placeholder instead of flashing the signed-out button. */
  authReady: boolean;
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  clipboard: ClipboardEntry | null;
  onSelectSnippet: (snippetId: string) => void;
  onGoHome: () => void;
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  onOpenPreferences: () => void;
  onGoSpace: () => void;
  onOpenCreateModal: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  /** Soft-delete a whole multi-selection at once (batch delete). */
  onDeleteMany: (items: SelectedItem[]) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRenameSnippet: (id: string, title: string) => Promise<void>;
  onPinFolder: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onPinSnippet: (id: string, target: "aside" | "home", pinned: boolean) => Promise<void>;
  onCut: (entry: ClipboardEntry) => void;
  onCopy: (entry: ClipboardEntry) => void;
  onPaste: (targetFolderId: string | null) => Promise<void>;
  onSelectFolder?: (folderId: string) => void;
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
  /** Number of items currently in the trash, for the sidebar badge. */
  trashCount: number;
  /** Id of the snippet currently open in the main view, for highlighting in the tree. */
  selectedSnippetId: string | null;
  /** Id of the folder currently open in the main view, for highlighting in the tree. */
  selectedFolderId: string | null;
  isOpen: boolean;
  isMobile: boolean;
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
