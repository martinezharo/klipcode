import type {
  ClipboardEntry,
  FolderRecord,
  SelectedItem,
  SnippetRecord,
} from "@/lib/types";
import type { Dictionary } from "@/i18n";

/**
 * Everything the workspace tree needs, independent of the shell around it.
 * `AsideProps` and `MobileHomeProps` both extend this so the two shells can
 * forward one object to {@link WorkspaceTree} without restating each callback.
 */
export interface WorkspaceTreeProps {
  folders: FolderRecord[];
  snippets: SnippetRecord[];
  copy: Dictionary;
  clipboard: ClipboardEntry | null;
  /** Id of the snippet currently open in the main view, for highlighting. */
  selectedSnippetId: string | null;
  /** Id of the folder currently open in the main view, for highlighting. */
  selectedFolderId: string | null;
  onSelectSnippet: (snippetId: string) => void;
  onSelectFolder?: (folderId: string) => void;
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
}
