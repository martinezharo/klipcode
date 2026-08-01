/**
 * Folder-hierarchy integrity, ported from the Postgres `validate_folder_hierarchy`
 * trigger. Postgres enforced this with a recursive CTE on every row write; here
 * the whole owner's folder set is already in memory inside the mutation
 * transaction, so one walk per touched folder is both cheaper and readable.
 */

export type ParentLink = { clientId: string; parentId: string | null };

/**
 * Throws if following `parentId` from any of `touchedIds` revisits a folder —
 * i.e. the write would create a cycle or a self-parent. `links` must contain the
 * owner's complete folder set as it will exist after the write.
 */
export function assertNoFolderCycles(links: ParentLink[], touchedIds: Iterable<string>): void {
  const parentOf = new Map(links.map((link) => [link.clientId, link.parentId]));

  for (const startId of touchedIds) {
    const seen = new Set<string>([startId]);
    let currentId = parentOf.get(startId) ?? null;

    while (currentId !== null) {
      if (seen.has(currentId)) {
        throw new Error("Folder hierarchy cannot contain cycles");
      }

      seen.add(currentId);

      if (!parentOf.has(currentId)) {
        // Dangling parent: the folder was deleted elsewhere. Not a cycle, and
        // `resolveParent` already reparents these to the root.
        break;
      }

      currentId = parentOf.get(currentId) ?? null;
    }
  }
}

/**
 * Every folder reachable from `rootIds` by walking children, including the roots
 * themselves. Used to cascade a folder deletion down its subtree, which is what
 * the `on delete cascade` on the old `(owner_id, parent_id)` foreign key did.
 */
export function collectDescendantFolderIds(
  links: ParentLink[],
  rootIds: Iterable<string>
): Set<string> {
  const childrenOf = new Map<string, string[]>();

  for (const link of links) {
    if (link.parentId === null) continue;
    const siblings = childrenOf.get(link.parentId);
    if (siblings) {
      siblings.push(link.clientId);
    } else {
      childrenOf.set(link.parentId, [link.clientId]);
    }
  }

  const collected = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const folderId = queue.pop()!;
    if (collected.has(folderId)) continue;
    collected.add(folderId);
    queue.push(...(childrenOf.get(folderId) ?? []));
  }

  return collected;
}
