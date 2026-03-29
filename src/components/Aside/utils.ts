import type { FolderRecord } from "@/lib/types";

export const STEP = 14;

export function sortByPinThenAlpha<T extends { isPinnedAside: boolean }>(
  items: T[],
  key: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinnedAside !== b.isPinnedAside) return a.isPinnedAside ? -1 : 1;
    return key(a).localeCompare(key(b));
  });
}

/** Returns true if `targetId` is `ancestorId` itself or a descendant of it. */
export function isDescendantOrSelf(
  folders: FolderRecord[],
  ancestorId: string,
  targetId: string,
): boolean {
  if (targetId === ancestorId) return true;
  let current = folders.find((f) => f.id === targetId);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = folders.find((f) => f.id === current!.parentId);
  }
  return false;
}
