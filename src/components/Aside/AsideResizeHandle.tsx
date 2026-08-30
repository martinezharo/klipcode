"use client";

import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

import type { Dictionary } from "@/i18n";
import { applyAsideWidth, readAsideWidth, setAsideResizing } from "@/lib/asideWidth";
import {
  ASIDE_COLLAPSE_THRESHOLD,
  clampAsideWidth,
  DEFAULT_ASIDE_WIDTH,
  MAX_ASIDE_WIDTH,
  MIN_ASIDE_WIDTH,
} from "@/lib/constants/layout";

/** Pixels per arrow key press; Shift moves in bigger jumps. */
const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_LARGE = 48;
const SNAP_TRANSITION_MS = 180;

interface AsideResizeHandleProps {
  copy: Dictionary;
  /** The clipping shell whose width previews the snap while dragging. */
  shellRef: RefObject<HTMLDivElement | null>;
  /** Shows or hides the recovery cue while the pointer remains held. */
  onCollapsePreviewChange: (collapsed: boolean) => void;
  /** Persist a settled width — drag released, arrow key, or reset. */
  onCommit: (width: number) => void;
  /** Released past the collapse threshold: treat the drag as "close the panel". */
  onCollapse: () => void;
}

/**
 * The draggable edge of the desktop aside.
 *
 * A drag never goes through React state: `pointermove` writes the width custom
 * property straight to the DOM, so the workspace tree is not re-rendered once
 * per pixel. `width` here mirrors that variable for ARIA and as the base of the
 * next gesture, and only catches up when a gesture settles.
 *
 * It is also a keyboard control (the ARIA window-splitter pattern) — a
 * pointer-only affordance would put the width out of reach for anyone not using
 * a mouse.
 */
export function AsideResizeHandle({
  copy,
  shellRef,
  onCollapsePreviewChange,
  onCommit,
  onCollapse,
}: AsideResizeHandleProps) {
  const [width, setWidth] = useState(DEFAULT_ASIDE_WIDTH);
  const collapsePreview = useRef(false);
  const snapTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    /** Unclamped width under the cursor, which decides the collapse snap. */
    raw: number;
  } | null>(null);

  useEffect(() => {
    // The init script may have applied a stored width before hydration, so the
    // DOM — not the default — is what we start from. A synchronise-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(readAsideWidth());
  }, []);

  // Nothing should stay half-dragged if we unmount mid-gesture (the panel being
  // collapsed, or the viewport crossing into the touch layout).
  useEffect(
    () => () => {
      setAsideResizing(false);
      if (snapTransitionTimer.current) clearTimeout(snapTransitionTimer.current);
      if (shellRef.current) {
        shellRef.current.style.removeProperty("width");
        delete shellRef.current.dataset.collapsePreview;
      }
    },
    [shellRef],
  );

  function clearSnapTransitionTimer() {
    if (!snapTransitionTimer.current) return;
    clearTimeout(snapTransitionTimer.current);
    snapTransitionTimer.current = null;
  }

  function previewWidth(raw: number, nextWidth: number) {
    const shell = shellRef.current;
    if (!shell) return;

    const collapsed = raw < ASIDE_COLLAPSE_THRESHOLD;
    if (collapsePreview.current !== collapsed) {
      collapsePreview.current = collapsed;
      onCollapsePreviewChange(collapsed);
      clearSnapTransitionTimer();

      if (collapsed) {
        shell.dataset.collapsePreview = "true";
      } else {
        // Keep the snap transition for the return trip, then hand width control
        // back to direct pointer tracking once the panel has visibly recovered.
        snapTransitionTimer.current = setTimeout(() => {
          if (!collapsePreview.current) delete shell.dataset.collapsePreview;
          snapTransitionTimer.current = null;
        }, SNAP_TRANSITION_MS);
      }
    }

    shell.style.width = collapsed ? "0px" : `${nextWidth}px`;
  }

  function clearCollapsePreview() {
    clearSnapTransitionTimer();
    collapsePreview.current = false;
    onCollapsePreviewChange(false);
    if (shellRef.current) delete shellRef.current.dataset.collapsePreview;
  }

  function commit(next: number) {
    setWidth(next);
    applyAsideWidth(next);
    onCommit(next);
  }

  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Keeps the drag from selecting the tree labels it passes over.
    e.preventDefault();
    const startWidth = readAsideWidth();
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startWidth, raw: startWidth };
    clearCollapsePreview();
    shellRef.current?.style.removeProperty("width");
    // Capture routes the rest of the gesture here even when the cursor outruns
    // this 4px strip, so no window-level listeners are needed.
    e.currentTarget.setPointerCapture(e.pointerId);
    setAsideResizing(true);
  }

  function resize(e: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    state.raw = state.startWidth + (e.clientX - state.startX);
    const nextWidth = clampAsideWidth(state.raw);
    applyAsideWidth(nextWidth);

    // Snap the clipping shell shut as soon as the pointer crosses the threshold
    // without committing React's open state yet. Pointer capture keeps the
    // preview reversible while a visible edge cue points back to the panel.
    previewWidth(state.raw, nextWidth);
  }

  function endResize(e: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    drag.current = null;
    setAsideResizing(false);
    clearCollapsePreview();

    if (state.raw < ASIDE_COLLAPSE_THRESHOLD) {
      // Dragged shut. Restore the last committed width first so re-opening
      // brings back the panel the user sized, not the minimum.
      applyAsideWidth(width);
      onCollapse();
      const shell = shellRef.current;
      requestAnimationFrame(() => shell?.style.removeProperty("width"));
      return;
    }
    shellRef.current?.style.removeProperty("width");
    commit(clampAsideWidth(state.raw));
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      commit(clampAsideWidth(width - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      commit(clampAsideWidth(width + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(MIN_ASIDE_WIDTH);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(MAX_ASIDE_WIDTH);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={copy.aside.resize}
      aria-controls="klipcode-aside"
      aria-valuenow={Math.round(width)}
      aria-valuemin={MIN_ASIDE_WIDTH}
      aria-valuemax={MAX_ASIDE_WIDTH}
      tabIndex={0}
      className="klipcode-aside-resizer absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize transition-colors duration-150 hover:bg-ink/15"
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      onKeyDown={onKeyDown}
      onDoubleClick={() => commit(DEFAULT_ASIDE_WIDTH)}
    />
  );
}
