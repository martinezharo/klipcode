"use client";

import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type Placement = "top" | "bottom" | "left" | "right";

const GAP = 6;

/* ── Position calculation ───────────────────────────────────────────────────── */

function calcPosition(
  trigger: DOMRect,
  tooltip: DOMRect,
  preferred: Placement,
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = 8;

  const candidates: Record<Placement, { x: number; y: number }> = {
    top: {
      x: trigger.left + trigger.width / 2 - tooltip.width / 2,
      y: trigger.top - tooltip.height - GAP,
    },
    bottom: {
      x: trigger.left + trigger.width / 2 - tooltip.width / 2,
      y: trigger.bottom + GAP,
    },
    left: {
      x: trigger.left - tooltip.width - GAP,
      y: trigger.top + trigger.height / 2 - tooltip.height / 2,
    },
    right: {
      x: trigger.right + GAP,
      y: trigger.top + trigger.height / 2 - tooltip.height / 2,
    },
  };

  const order: Record<Placement, Placement[]> = {
    top: ["top", "bottom", "right", "left"],
    bottom: ["bottom", "top", "right", "left"],
    left: ["left", "right", "top", "bottom"],
    right: ["right", "left", "top", "bottom"],
  };

  for (const p of order[preferred]) {
    const c = candidates[p];
    if (
      c.x >= m &&
      c.x + tooltip.width <= vw - m &&
      c.y >= m &&
      c.y + tooltip.height <= vh - m
    ) {
      return c;
    }
  }

  const c = candidates[preferred];
  return {
    x: Math.max(m, Math.min(c.x, vw - tooltip.width - m)),
    y: Math.max(m, Math.min(c.y, vh - tooltip.height - m)),
  };
}

/* ── Shared tooltip styles ──────────────────────────────────────────────────── */

const tooltipStyle = {
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
} as const;

const tooltipClass =
  "klipcode-tooltip-animate pointer-events-none fixed z-[1000] max-w-[280px] rounded-lg px-2.5 py-1.5 text-[12px] leading-normal text-white/80 font-medium";

/* ── useTooltipState (shared logic) ─────────────────────────────────────────── */

function useTooltipState(delay: number) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => hide();
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", handleKey);
    };
  }, [visible, hide]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { visible, schedule, hide };
}

/* ── useTooltipPosition ─────────────────────────────────────────────────────── */

function useTooltipPosition(
  visible: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
  placement: Placement,
) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 });

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const tRect = triggerRef.current.getBoundingClientRect();
    const ttRect = tooltipRef.current.getBoundingClientRect();
    setPos(calcPosition(tRect, ttRect, placement));
  }, [visible, triggerRef, tooltipRef, placement]);

  return pos;
}

/* ── Tooltip ────────────────────────────────────────────────────────────────── */

interface TooltipProps {
  content: string;
  placement?: Placement;
  delay?: number;
  children: ReactNode;
  wrapperClassName?: string;
}

export function Tooltip({
  content,
  placement = "top",
  delay = 500,
  children,
  wrapperClassName,
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { visible, schedule, hide } = useTooltipState(delay);
  const pos = useTooltipPosition(visible, triggerRef, tooltipRef, placement);

  if (!content) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={schedule}
        onMouseLeave={hide}
        onPointerDown={hide}
        onFocus={schedule}
        onBlur={hide}
        className={wrapperClassName ?? "inline-flex"}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={tooltipClass}
            style={{ left: pos.x, top: pos.y, ...tooltipStyle }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ── TruncateTooltip ────────────────────────────────────────────────────────── */

interface TruncateTooltipProps {
  text: string;
  className?: string;
  placement?: Placement;
  delay?: number;
}

export function TruncateTooltip({
  text,
  className,
  placement = "top",
  delay = 600,
}: TruncateTooltipProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { visible, schedule, hide } = useTooltipState(delay);
  const pos = useTooltipPosition(visible, spanRef, tooltipRef, placement);

  const show = useCallback(() => {
    if (!spanRef.current) return;
    if (spanRef.current.scrollWidth <= spanRef.current.clientWidth) return;
    schedule();
  }, [schedule]);

  return (
    <>
      <span
        ref={spanRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className={className ?? "truncate"}
      >
        {text}
      </span>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={tooltipClass}
            style={{ left: pos.x, top: pos.y, ...tooltipStyle }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
