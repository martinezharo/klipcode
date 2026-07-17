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
  /**
   * When true, the label is rendered without the truncating wrapper span.
   * Use when the label itself manages its own layout (e.g. an inline
   * contentEditable title that should grow with its content).
   */
  raw?: boolean;
}
interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Slot rendered before the breadcrumb trail (e.g. hamburger toggle button). */
  leading?: React.ReactNode;
  /** Slot rendered to the right of the breadcrumb trail (e.g. action buttons). */
  actions?: React.ReactNode;
  /**
   * When `true`, the "stuck" appearance (border + backdrop) is applied immediately
   * without relying on scroll detection. Use this when the breadcrumb sits inside
   * a non-scrolling layout (e.g. the full-screen snippet editor).
   * @default false
   */
  defaultStuck?: boolean;
  /**
   * When `true`, on mobile the `actions` slot wraps onto its own row below the
   * trail, and the trail becomes horizontally scrollable anchored to its end
   * (the current/last crumb is shown first; slide left to reveal ancestors).
   * @default false
   */
  stackActionsOnMobile?: boolean;
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
  leading,
  actions,
  defaultStuck = false,
  stackActionsOnMobile = false,
  className,
}: BreadcrumbsProps) {
  const navRef = useRef<HTMLElement>(null);
  const trailRef = useRef<HTMLOListElement>(null);
  const [isStuck, setIsStuck] = useState(defaultStuck);

  // Keep the trail scrolled to its end so the current (last) crumb stays visible;
  // the user slides left to reveal ancestors. Only meaningful when the trail can
  // overflow horizontally (mobile, with `stackActionsOnMobile`).
  useEffect(() => {
    if (!stackActionsOnMobile) return;
    const trail = trailRef.current;
    if (!trail) return;
    trail.scrollLeft = trail.scrollWidth;
  }, [stackActionsOnMobile, items]);

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
        "sticky top-0 z-10 flex min-h-11 w-full items-center gap-2 border-b border-transparent px-6 py-1.5",
        "transition-[background-color,border-color] duration-200",
        stackActionsOnMobile && "flex-wrap sm:flex-nowrap",
        isStuck
          ? "border-ink/[0.06] bg-background/90 backdrop-blur-md"
          : "bg-transparent",
        className
      )}
    >
      {leading && (
        <div className="flex shrink-0 items-center">{leading}</div>
      )}
      <ol
        ref={trailRef}
        className={cn(
          "flex flex-1 min-w-0 items-center gap-0.5 whitespace-nowrap",
          stackActionsOnMobile
            ? "overflow-x-auto sm:overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "overflow-hidden"
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center",
                // In scroll mode, keep natural width on mobile so the trail
                // overflows (and scrolls) instead of truncating each crumb.
                stackActionsOnMobile && "max-sm:shrink-0",
                // An auto inline-start margin on the first crumb pins the whole
                // trail to the right edge when it fits, and collapses to 0 when
                // it overflows (then the scroll-to-end below keeps the current
                // crumb visible). More robust than `justify-end` on a scroller.
                stackActionsOnMobile && index === 0 && "max-sm:ms-auto"
              )}
            >
              {index > 0 && (
                <ChevronRight
                  size={11}
                  className="mx-1 shrink-0 text-ink/[0.18]"
                  aria-hidden="true"
                />
              )}
              {/* Last item without onClick → static, visually highlighted */}
              {isLast && !item.onClick ? (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground min-w-0">
                  {item.icon}
                  {item.raw ? item.label : <span className="min-w-0 truncate">{item.label}</span>}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] text-ink/40 min-w-0 transition-colors hover:text-ink/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/20"
                >
                  {item.icon}
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {actions && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            stackActionsOnMobile && "basis-full justify-end sm:basis-auto sm:justify-normal"
          )}
        >
          {actions}
        </div>
      )}
    </nav>
  );
}
