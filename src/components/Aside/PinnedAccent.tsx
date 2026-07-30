/**
 * Marks an aside row as pinned with a small accent bar on the row's leading
 * edge, instead of a badge over the row's icon — the leading icon is a
 * color-coded language logo, and overlaying anything on it muddies the glyph
 * the user actually scans for.
 *
 * The bar sits at the row's left edge (x = 0) at every depth, so it never
 * collides with the folder guide lines, which start at `paddingLeft + 6`. The
 * row must be positioned (`relative`), which `sharedRowClass` already is.
 *
 * Pinning/unpinning happens from the ⋮/context menu; this is status only.
 */
export function PinnedAccent({ pinned, label }: { pinned: boolean; label: string }) {
  if (!pinned) return null;

  return (
    <>
      <span
        aria-hidden
        className="absolute bottom-[3px] left-0 top-[3px] w-[2px] rounded-full bg-ink/30"
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * Separates the pinned block from the rest of a list. Only the aside root
 * groups its items that way (pinned folders + snippets, then the rest); inside
 * a folder, folders and snippets are two separately pin-sorted groups, so there
 * is no single boundary to draw and the accent bars carry the state alone.
 */
export function PinnedDivider() {
  return <div className="mx-2 my-1.5 border-t border-ink/5" />;
}
