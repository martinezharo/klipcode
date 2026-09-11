import Image, { inputRegex, type ImageOptions } from "@tiptap/extension-image";
import { ReactNodeViewRenderer, nodeInputRule } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import {
  clampDisplayWidth,
  readImageAlignment,
  readImageWidth,
  stripImageAlignment,
  stripImageWidth,
  writeImageAlignment,
  writeImageWidth,
  type ImageAlignment,
} from "@/lib/images";
import type { MarkdownEditorCopy } from "./MarkdownEditor";
import { ImageComponent } from "./ImageComponent";

/**
 * The image node as KlipCode stores it: a plain Markdown image, plus a display
 * width the user can drag.
 *
 * Markdown has nowhere to put a size, so the width rides along in the URL
 * fragment (`…#w=480`, see `src/lib/images.ts`). Here it is split back out into
 * a real node attribute on the way in and folded back into the link on the way
 * out, which keeps the rest of the editor — and the NodeView — working with an
 * ordinary number.
 *
 * Images stay *inline* nodes. A block image would read better on its own, but
 * it would also rewrite every document that puts images in a sentence — a row
 * of README badges is one paragraph, and opening such a snippet must not
 * silently explode it into one line per badge.
 */

/**
 * The slice of tiptap-markdown's serializer state this node needs. The package
 * ships no types for it, and structural typing keeps us honest about exactly
 * which two methods we depend on.
 */
interface MarkdownWriter {
  write(text: string): void;
  esc(text: string): string;
}

export interface ResizableImageOptions extends ImageOptions {
  /** Labels for the resize handles and the hover toolbar. */
  imageCopy: MarkdownEditorCopy["image"] | null;
}

/** Split `src` (as authored) into the URL to fetch and the width to render at. */
function splitSource(rawSrc: string | null): {
  src: string | null;
  width: number | null;
  align: ImageAlignment;
} {
  if (!rawSrc) return { src: null, width: null, align: "left" };
  return {
    src: stripImageAlignment(stripImageWidth(rawSrc)) || null,
    width: readImageWidth(rawSrc),
    align: readImageAlignment(rawSrc),
  };
}

export const ResizableImage = Image.extend<ResizableImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      // Inline so images can sit in a line of prose (see the note above).
      inline: true,
      // Base64 images are rejected on purpose: inlining a megabyte of data URL
      // into the Markdown would bloat every sync and every copy of the snippet.
      // Pasted image data goes through the upload path instead.
      allowBase64: false,
      imageCopy: null,
    };
  },

  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Record<string, object>;

    return {
      ...parent,
      src: {
        ...parent.src,
        parseHTML: (element: HTMLElement) =>
          splitSource(element.getAttribute("src")).src,
      },
      width: {
        default: null,
        // An explicit `width` attribute wins (that's what we render), and the
        // URL fragment is the fallback for a document arriving as Markdown.
        parseHTML: (element: HTMLElement) => {
          const attribute = Number(element.getAttribute("width"));
          if (Number.isFinite(attribute) && attribute > 0) {
            return clampDisplayWidth(attribute);
          }
          return splitSource(element.getAttribute("src")).width;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.width === "number" ? { width: String(attributes.width) } : {},
      },
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) =>
          readImageAlignment(element.getAttribute("src") ?? ""),
        renderHTML: () => ({}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent, { as: "span" });
  },

  addInputRules() {
    // Same rule as the base extension (typing `![alt](src)`), with the width
    // fragment lifted out so a hand-typed URL behaves like a parsed one.
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => {
          const [, , alt, rawSrc, title] = match;
          return { ...splitSource(rawSrc), alt, title };
        },
      }),
    ];
  },

  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: MarkdownWriter, node: ProseMirrorNode) {
          const src = writeImageAlignment(
            writeImageWidth(
              (node.attrs.src as string | null) ?? "",
              (node.attrs.width as number | null) ?? null,
            ),
            (node.attrs.align as ImageAlignment | null) ?? "left",
          );
          const title = node.attrs.title as string | null;

          state.write(
            `![${state.esc((node.attrs.alt as string | null) ?? "")}](${src.replace(
              /[()]/g,
              "\\$&",
            )}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`,
          );
        },
        parse: {
          // markdown-it already turns `![alt](src)` into an <img>, which
          // `parseHTML` above picks up.
        },
      },
    };
  },
});
