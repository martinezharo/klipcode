"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  /** Unique key for React reconciliation. */
  id: string;
  /** Text or node rendered as the breadcrumb label. */
  label: React.ReactNode;
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode;
  /**
   * When provided, the item renders as a button.
   * When omitted, the last item renders as a static span.
   */
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Slot rendered to the right of the breadcrumb trail (e.g. action buttons). */
  actions?: React.ReactNode;
  /**
   * When `true`, the "stuck" appearance (border + backdrop) is applied immediately
   * without relying on scroll detection. Use this when the breadcrumb sits inside
   * a non-scrolling layout (e.g. the full-screen snippet editor).
   * @default false
   */
  defaultStuck?: boolean;
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function findScrollParent(node: HTMLElement): HTMLElement | null {
  const parent = node.parentElement;
  if (!parent) return null;
  const { overflowY } = getComputedStyle(parent);
  if (overflowY === "auto" || overflowY === "scroll") return parent;
  return findScrollParent(parent);
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function Breadcrumbs({
  items,
  actions,
  defaultStuck = false,
  className,
}: BreadcrumbsProps) {
  const navRef = useRef<HTMLElement>(null);
  const [isStuck, setIsStuck] = useState(defaultStuck);

  useEffect(() => {
    // No dynamic detection needed when the component is always in "stuck" mode.
    if (defaultStuck) return;

    const bar = navRef.current;
    if (!bar) return;

    const scrollParent = findScrollParent(bar);
    if (!scrollParent) return;

    function onScroll() {
      setIsStuck(scrollParent!.scrollTop > 4);
    }

    scrollParent.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // evaluate on mount

    return () => scrollParent.removeEventListener("scroll", onScroll);
  }, [defaultStuck]);

  return (
    <nav
      ref={navRef}
      aria-label="breadcrumb"
      className={cn(
        "sticky top-0 z-10 flex w-full items-center gap-2 px-6 py-2.5",
        "transition-[background-color,border-color] duration-200",
        isStuck
          ? "border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-md"
          : "bg-transparent",
        className
      )}
    >
      <ol className="flex flex-1 flex-wrap items-center gap-0.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.id} className="flex items-center">
              {index > 0 && (
                <ChevronRight
                  size={11}
                  className="mx-1 shrink-0 text-white/[0.18]"
                  aria-hidden="true"
                />
              )}

              {/* Last item without onClick → static, visually highlighted */}
              {isLast && !item.onClick ? (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </nav>
  );
}
