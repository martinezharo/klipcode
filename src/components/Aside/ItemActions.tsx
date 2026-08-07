import { MoreHorizontal } from "lucide-react";
import { Tooltip } from "@/ui/Tooltip";
import { IconButton } from "@/ui/IconButton";

/**
 * The row's "more options" control.
 *
 * Gated on `lg`, not `md`: the shell switches to the touch layout at 1024px, so
 * hiding this behind `:hover` at 768px left it unreachable on tablets, which
 * render the touch layout but have no hover. See `lib/constants/layout.ts`.
 */
export function ItemActions({
  onMore,
  label,
}: {
  onMore?: (e: React.MouseEvent) => void;
  label: string;
}) {
  return (
    <span
      data-no-drag=""
      className="visible flex shrink-0 items-center gap-px lg:invisible lg:group-hover:visible lg:group-focus-within:visible"
    >
      <Tooltip content={label}>
        <IconButton
          aria-label={label}
          className="text-ink/35 hover:bg-ink/[0.08] hover:text-ink/70 lg:p-0.5"
          onClick={onMore}
        >
          <MoreHorizontal size={14} />
        </IconButton>
      </Tooltip>
    </span>
  );
}
