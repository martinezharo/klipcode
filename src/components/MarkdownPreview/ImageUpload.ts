import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import {
  ImageUploadError,
  imageFilesFrom,
  uploadSnippetImage,
  type ImageUploadFailure,
} from "./imageApi";

/**
 * Every way an image gets into a Markdown snippet: paste it, drop it, or pick
 * it from the slash menu. All three land on {@link startImageUpload}, so the
 * document only ever gains an image node once the bytes are safely in R2.
 *
 * While the upload is in flight the editor shows a shimmering placeholder at
 * the insertion point. It is a ProseMirror *decoration*, not a node: the
 * document never contains a temporary `blob:` URL, so a save that lands
 * mid-upload can't write a URL that only resolves on the uploading device.
 */

interface PlaceholderAction {
  add?: { id: object; pos: number; label: string };
  remove?: { id: object };
}

const placeholderKey = new PluginKey<DecorationSet>("klipcodeImageUploadPlaceholder");

function createPlaceholderElement(label: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "klipcode-md-image-uploading";
  element.setAttribute("role", "status");
  element.setAttribute("aria-label", label);
  element.textContent = label;
  return element;
}

/** Where the placeholder with this token currently sits, or null if it's gone. */
function findPlaceholder(view: EditorView, id: object): number | null {
  const decorations = placeholderKey.getState(view.state);
  const found = decorations?.find(undefined, undefined, (spec) => spec.id === id);
  return found?.length ? found[0].from : null;
}

export interface ImageUploadHandlers {
  /** Reports a failed upload so the UI can show a localized message. */
  onError: (reason: ImageUploadFailure) => void;
  /** Label for the in-flight placeholder, e.g. "Uploading image…". */
  uploadingLabel: string;
}

/**
 * Options are read at editor-construction time and the editor instance outlives
 * every re-render, so handlers arrive through a ref-style box the caller can
 * keep current without rebuilding the document.
 */
export interface ImageUploadOptions {
  handlers: { current: ImageUploadHandlers | null };
}

/**
 * Insert a placeholder, upload, then swap in the image node. Resolves to the
 * mapped position immediately after the inserted image (or the failed slot).
 */
export async function startImageUpload(
  view: EditorView,
  file: File,
  pos: number,
  handlers: ImageUploadHandlers,
): Promise<number | null> {
  const id = {};

  const insert = view.state.tr;
  // Dropping onto a selection replaces it, matching what pasting text does.
  if (!insert.selection.empty) insert.deleteSelection();
  const at = Math.min(pos, insert.doc.content.size);
  insert.setMeta(placeholderKey, {
    add: { id, pos: at, label: handlers.uploadingLabel },
  } satisfies PlaceholderAction);
  view.dispatch(insert);

  try {
    const uploaded = await uploadSnippetImage(file);
    if (view.isDestroyed) return null;

    const placeholderPos = findPlaceholder(view, id);
    // The user undid, or deleted the surrounding block, while we uploaded:
    // the image is stored but has nowhere to go. Dropping it is the least
    // surprising outcome — inserting it somewhere else would not be.
    if (placeholderPos === null) return null;

    const node = view.state.schema.nodes.image.create({
      src: uploaded.url,
      alt: file.name.replace(/\.[^.]+$/, ""),
    });

    view.dispatch(
      view.state.tr
        .replaceWith(placeholderPos, placeholderPos, node)
        .setMeta(placeholderKey, { remove: { id } } satisfies PlaceholderAction),
    );
    return placeholderPos + node.nodeSize;
  } catch (error: unknown) {
    if (view.isDestroyed) return null;
    const placeholderPos = findPlaceholder(view, id) ?? pos;
    view.dispatch(
      view.state.tr.setMeta(placeholderKey, { remove: { id } } satisfies PlaceholderAction),
    );
    handlers.onError(
      error instanceof ImageUploadError ? error.reason : "failed",
    );
    return placeholderPos;
  }
}

/** Upload several files in order, each after the previous insertion point. */
async function startImageUploads(
  view: EditorView,
  files: File[],
  pos: number,
  handlers: ImageUploadHandlers,
): Promise<void> {
  let nextPos = pos;
  for (const file of files) {
    if (view.isDestroyed) return;
    const insertedAt = await startImageUpload(view, file, nextPos, handlers);
    if (insertedAt === null) return;
    nextPos = insertedAt;
  }
}

/**
 * Consume a clipboard paste when it carries image bytes. Kept separate from
 * the extension so the editor can install it as its direct `handlePaste`
 * property, ahead of tiptap-markdown's generic clipboard handling.
 */
export function handleImagePaste(
  view: EditorView,
  event: ClipboardEvent,
  handlers: ImageUploadHandlers | null,
): boolean {
  if (!handlers || !view.editable) return false;

  const files = imageFilesFrom(event.clipboardData);
  if (files.length === 0) return false;

  // Copying an image from a browser can provide both the file and HTML that
  // points to the original site. Owning the bytes avoids a hotlink that may
  // expire or require the original user's session.
  event.preventDefault();
  void startImageUploads(view, files, view.state.selection.from, handlers);
  return true;
}

/**
 * Upload files and insert them at the cursor once stored — the entry point for
 * anything outside ProseMirror (today, the slash menu's file picker).
 */
export function uploadImageFiles(
  editor: Editor,
  files: File[],
  handlers: ImageUploadHandlers | null,
): void {
  if (!handlers || files.length === 0) return;
  void startImageUploads(editor.view, files, editor.state.selection.from, handlers);
}

export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: "klipcodeImageUpload",

  addOptions() {
    return { handlers: { current: null } };
  },

  addProseMirrorPlugins() {
    const getHandlers = () => this.options.handlers.current;

    return [
      new Plugin({
        key: placeholderKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // Keep placeholders pinned to their text as the document changes
            // around them (another upload finishing, the user typing above).
            let next = set.map(tr.mapping, tr.doc);
            const action = tr.getMeta(placeholderKey) as PlaceholderAction | undefined;

            if (action?.add) {
              next = next.add(tr.doc, [
                Decoration.widget(action.add.pos, createPlaceholderElement(action.add.label), {
                  id: action.add.id,
                }),
              ]);
            }

            if (action?.remove) {
              next = next.remove(
                next.find(undefined, undefined, (spec) => spec.id === action.remove!.id),
              );
            }

            return next;
          },
        },
        props: {
          decorations(state) {
            return placeholderKey.getState(state);
          },

          handleDrop(view, event, _slice, moved) {
            const handlers = getHandlers();
            // `moved` is a node being dragged within the document, not a file.
            if (!handlers || !view.editable || moved) return false;

            const files = imageFilesFrom(event.dataTransfer);
            if (files.length === 0) return false;

            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            void startImageUploads(
              view,
              files,
              coords?.pos ?? view.state.selection.from,
              handlers,
            );
            return true;
          },
        },
      }),
    ];
  },
});
