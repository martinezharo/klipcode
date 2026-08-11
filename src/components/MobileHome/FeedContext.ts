"use client";

import { createContext, useContext } from "react";

import type { MenuTarget } from "@/components/Aside/types";
import type { Dictionary } from "@/i18n";
import type { FolderRecord, SnippetRecord } from "@/lib/types";

/**
 * What a nested feed row needs from the mobile home.
 *
 * Folder groups nest arbitrarily deep, so threading a dozen callbacks down by
 * hand would mean every intermediate level restating props it doesn't use —
 * the same reason the desktop tree has `AsideCtx`. This is deliberately the
 * smaller shape: the mobile feed has no drag & drop and no multi-selection
 * (neither exists on touch), so none of that appears here.
 */
export interface FeedCtxShape {
  copy: Dictionary;
  /** Child folders / snippets by parent folder id, precomputed once per render. */
  foldersByParent: ReadonlyMap<string, FolderRecord[]>;
  snippetsByFolder: ReadonlyMap<string, SnippetRecord[]>;
  /** Id of the row being renamed inline, if any. */
  renamingId: string | null;
  /** undefined = not creating, null = creating at root, string = inside that folder. */
  creatingFolderParentId: string | null | undefined;
  /** Open in the main view — highlighted when the user comes back. */
  selectedSnippetId: string | null;
  selectedFolderId: string | null;
  openSnippet: (id: string) => void;
  openFolder: (id: string) => void;
  /** Opens the shared actions menu for a row, anchored at viewport coordinates. */
  openMenu: (target: MenuTarget) => void;
  submitFolderRename: (id: string, value: string) => void;
  submitSnippetRename: (id: string, value: string) => void;
  cancelRename: () => void;
  submitCreateFolder: (parentId: string | null, name: string) => void;
  cancelCreateFolder: () => void;
}

export const FeedCtx = createContext<FeedCtxShape>(null!);

export function useFeedCtx() {
  return useContext(FeedCtx);
}
