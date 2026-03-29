import type { FolderRecord, SnippetRecord } from "@/lib/types";

/** Walk up from `folderId` to build an ancestor path (root-first). */
export function getFolderPath(
  folderId: string,
  folders: FolderRecord[],
): FolderRecord[] {
  const path: FolderRecord[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    const parentId = current.parentId;
    current = parentId ? folders.find((f) => f.id === parentId) : undefined;
  }
  return path;
}

/** Map folderId → direct snippet count. */
export function buildSnippetCountMap(
  snippets: SnippetRecord[],
): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const s of snippets) {
    map.set(s.folderId, (map.get(s.folderId) ?? 0) + 1);
  }
  return map;
}

/** Map folderId → direct sub-folder count. */
export function buildSubFolderCountMap(
  folders: FolderRecord[],
): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const f of folders) {
    map.set(f.parentId, (map.get(f.parentId) ?? 0) + 1);
  }
  return map;
}
