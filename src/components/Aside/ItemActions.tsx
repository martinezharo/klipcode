import { MoreHorizontal } from "lucide-react";

export function ItemActions({
  onMore,
}: {
  onMore?: (e: React.MouseEvent) => void;
}) {
  return (
    <span className="invisible flex shrink-0 items-center gap-px group-hover:visible">
      <span
        role="button"
        className="rounded p-0.5 text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/70"
        onClick={onMore}
      >
        <MoreHorizontal size={12} />
      </span>
    </span>
  );
}
