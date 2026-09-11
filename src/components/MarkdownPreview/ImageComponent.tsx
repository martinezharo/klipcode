"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, RotateCcw, Trash2 } from "lucide-react";

import { Tooltip } from "@/ui/Tooltip";
import {
  ContextMenu,
  type ContextMenuGroup,
} from "@/components/ContextMenu/ContextMenu";
import {
  IMAGE_MAX_DISPLAY_WIDTH,
  IMAGE_MIN_DISPLAY_WIDTH,
  clampDisplayWidth,
  type ImageAlignment,
} from "@/lib/images";
import type { MarkdownEditorCopy } from "./MarkdownEditor";

/**
 * NodeView for images: the picture itself, plus the controls that make its size
 * adjustable — a drag handle on each side, and a hover toolbar with width
 * presets, a reset and a delete.
 *
 * Dragging updates a local width so the image tracks the pointer at display
 * refresh rate; the node attribute (and therefore the Markdown, and therefore a
 * save) is written once on release. Resizing a picture is one edit, not two
 * hundred — this is what keeps undo sensible and the debounced save quiet.
 */

/** Share of the available column width offered as a preset. */
const WIDTH_PRESETS = [0.25, 0.5, 0.75, 1] as const;

/** Keyboard nudge for the resize handles, and its Shift-accelerated variant. */
const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_LARGE = 64;

const ALIGNMENT_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} satisfies Record<ImageAlignment, typeof AlignLeft>;

export function ImageComponent({
  node,
  updateAttributes,
  editor,
  selected,
  deleteNode,
  extension,
}: NodeViewProps) {
  const copy = extension.options.imageCopy as MarkdownEditorCopy["image"] | null;
  const src = (node.attrs.src as string | null) ?? "";
  const alt = (node.attrs.alt as string | null) ?? "";
  const committedWidth = node.attrs.width as number | null;
  const alignment = (node.attrs.align as ImageAlignment | null) ?? "left";

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Width while a drag is in flight. Mirrored into a ref so the pointer-up
  // handler can read the final value without re-subscribing on every frame.
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const draftWidthRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [alignmentMenu, setAlignmentMenu] = useState<{ x: number; y: number } | null>(null);

  const editable = editor.isEditable;
  const width = draftWidth ?? committedWidth;
  const resizing = draftWidth !== null;

  /** Width of the text column, i.e. the widest the image may be laid out. */
  const availableWidth = useCallback(() => {
    // The image is inline, so its immediate parent can report a zero
    // `clientWidth` even though the editor column has a real rendered width.
    // Measuring that parent made the presets fall back to 2048px: 25% became
    // 512px and 50/75/100% all hit the same CSS max-width, which looked like
    // intermittently dead buttons. The editor DOM is the actual containing
    // block and remains correct as the split pane or viewport changes size.
    return editor.view.dom.clientWidth || IMAGE_MAX_DISPLAY_WIDTH;
  }, [editor]);

  const setDraft = useCallback((value: number | null) => {
    draftWidthRef.current = value;
    setDraftWidth(value);
  }, []);

  const commitWidth = useCallback(
    (value: number | null) => {
      updateAttributes({ width: value === null ? null : clampDisplayWidth(value) });
    },
    [updateAttributes],
  );

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, side: "left" | "right") => {
      if (!editable || event.button !== 0) return;
      // The editor must not turn the drag into a text selection or a node drag.
      event.preventDefault();
      event.stopPropagation();
      dragCleanupRef.current?.();

      const startX = event.clientX;
      const startWidth = imageRef.current?.getBoundingClientRect().width ?? availableWidth();
      const maxWidth = availableWidth();

      const onMove = (move: PointerEvent) => {
        // The left handle grows the image as it travels away from it, so the
        // picture stays anchored where the user grabbed it.
        const delta = side === "right" ? move.clientX - startX : startX - move.clientX;
        setDraft(
          Math.min(
            maxWidth,
            Math.max(IMAGE_MIN_DISPLAY_WIDTH, clampDisplayWidth(startWidth + delta)),
          ),
        );
      };

      const onUp = () => {
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        const finalWidth = draftWidthRef.current;
        setDraft(null);
        if (finalWidth !== null) commitWidth(finalWidth);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    },
    [availableWidth, commitWidth, editable, setDraft],
  );

  const nudge = useCallback(
    (event: React.KeyboardEvent, side: "left" | "right") => {
      if (!editable) return;
      const direction =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (direction === 0) return;

      event.preventDefault();
      const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
      const current = imageRef.current?.getBoundingClientRect().width ?? availableWidth();
      const delta = (side === "right" ? direction : -direction) * step;
      commitWidth(Math.min(availableWidth(), current + delta));
    },
    [availableWidth, commitWidth, editable],
  );

  const openAlignmentMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAlignmentMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  // A resize started on a handle can end anywhere; make sure the listeners never
  // outlive the NodeView if the node is deleted mid-drag.
  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      draftWidthRef.current = null;
    },
    [],
  );

  if (!src) return null;

  const controlsVisible = editable && (selected || resizing || alignmentMenu !== null);
  const AlignmentIcon = ALIGNMENT_ICONS[alignment];
  const alignmentGroups: ContextMenuGroup[] = copy
    ? [
        {
          items: (["left", "center", "right"] as const).map((value) => ({
            id: `align-${value}`,
            label: copy.align[value],
            Icon: ALIGNMENT_ICONS[value],
            onClick: () => updateAttributes({ align: value }),
            selected: alignment === value,
          })),
        },
      ]
    : [];
  const handleClass = (side: "left" | "right") =>
    [
      "absolute top-1/2 z-10 h-10 w-[7px] -translate-y-1/2 cursor-ew-resize rounded-full",
      "border border-background/70 bg-ink/45 opacity-0 transition-opacity",
      "group-hover:opacity-100 focus-visible:opacity-100 hover:bg-ink/70",
      resizing || selected ? "opacity-100" : "",
      side === "left" ? "left-1.5" : "right-1.5",
    ].join(" ");

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      className="klipcode-md-image group"
      data-selected={selected ? "true" : undefined}
      data-resizing={resizing ? "true" : undefined}
      data-align={alignment}
    >
      <span className="klipcode-md-image-frame" style={width ? { width } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a Markdown
            document's images are arbitrary user URLs sized by the user, which
            is exactly what next/image's optimizer cannot do anything with. */}
        <img ref={imageRef} src={src} alt={alt} draggable={false} />

        {editable && (
          <span contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label={copy?.resizeLeft ?? ""}
              className={handleClass("left")}
              onPointerDown={(e) => startDrag(e, "left")}
              onKeyDown={(e) => nudge(e, "left")}
            />
            <button
              type="button"
              aria-label={copy?.resizeRight ?? ""}
              className={handleClass("right")}
              onPointerDown={(e) => startDrag(e, "right")}
              onKeyDown={(e) => nudge(e, "right")}
            />

            {resizing && (
              <span className="klipcode-md-image-size" aria-hidden="true">
                {Math.round(width ?? 0)} px
              </span>
            )}

            {copy && (
              <span
                className={[
                  "klipcode-md-image-toolbar",
                  controlsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                ].join(" ")}
              >
                {WIDTH_PRESETS.map((fraction) => (
                  <Tooltip
                    key={fraction}
                    content={copy.presetTooltip(Math.round(fraction * 100))}
                    placement="top"
                  >
                    <button
                      type="button"
                      className="klipcode-md-image-toolbar-button"
                      onClick={() => commitWidth(availableWidth() * fraction)}
                    >
                      {Math.round(fraction * 100)}%
                    </button>
                  </Tooltip>
                ))}
                <span className="mx-0.5 h-4 w-px bg-ink/[0.12]" />
                <Tooltip content={copy.alignment} placement="top">
                  <button
                    type="button"
                    aria-label={copy.alignment}
                    aria-haspopup="menu"
                    aria-expanded={alignmentMenu !== null}
                    className="klipcode-md-image-toolbar-button"
                    onClick={openAlignmentMenu}
                  >
                    <AlignmentIcon size={13} />
                  </button>
                </Tooltip>
                <Tooltip content={copy.resetSize} placement="top">
                  <button
                    type="button"
                    aria-label={copy.resetSize}
                    className="klipcode-md-image-toolbar-button"
                    onClick={() => commitWidth(null)}
                  >
                    <RotateCcw size={13} />
                  </button>
                </Tooltip>
                <Tooltip content={copy.delete} placement="top">
                  <button
                    type="button"
                    aria-label={copy.delete}
                    className="klipcode-md-image-toolbar-button text-red-400/80 hover:text-red-300"
                    onClick={() => deleteNode()}
                  >
                    <Trash2 size={13} />
                  </button>
                </Tooltip>
              </span>
            )}
          </span>
        )}
      </span>

      {alignmentMenu && (
        <ContextMenu
          x={alignmentMenu.x}
          y={alignmentMenu.y}
          groups={alignmentGroups}
          onClose={() => setAlignmentMenu(null)}
        />
      )}
    </NodeViewWrapper>
  );
}
