import { MoreHorizontal } from "lucide-react";
import { Tooltip } from "@/ui/Tooltip";

export function ItemActions({
  onMore,
  label,
}: {
  onMore?: (e: React.MouseEvent) => void;
  label: string;
}) {
  return (
    <span className="invisible flex shrink-0 items-center gap-px group-hover:visible">
      <Tooltip content={label}>
        <button
          type="button"
          aria-label={label}
          className="rounded p-0.5 text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/70"
          onClick={onMore}
        >
          <MoreHorizontal size={12} />
        </button>
      </Tooltip>
    </span>
  );
}
