/**
 * Central registry of keyboard shortcuts. Single source of truth shared by the
 * global key handler (`useGlobalShortcuts`) and the help overlay
 * (`ShortcutsDialog`) so the two never drift apart.
 *
 * Design note: every *action* shortcut uses the platform modifier (⌘ on macOS,
 * Ctrl elsewhere). Modifier combos are delivered to the `keydown` listener even
 * when the focus is inside an `<input>` or the CodeMirror editor, so these work
 * while the user is typing. Bare-key shortcuts (the arrows used to walk the card
 * list) are intentionally suppressed while a text field is focused.
 */

export type ShortcutId =
  | "search"
  | "newSnippet"
  | "createSnippet"
  | "openInEditor"
  | "toggleSidebar"
  | "help"
  | "copyCurrent"
  | "closeEditor"
  | "undoDelete"
  | "navigateList";

export type ShortcutSection = "general" | "editor" | "navigation";

export interface ShortcutDescriptor {
  id: ShortcutId;
  section: ShortcutSection;
  /** Requires the platform modifier — ⌘ on macOS, Ctrl elsewhere. */
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Literal key tokens to render (e.g. `["N"]`, `["↑", "↓"]`, `["Esc"]`). */
  keys: string[];
}

/** Order here is the order rendered in the help dialog within each section. */
export const SHORTCUTS: ShortcutDescriptor[] = [
  { id: "search", section: "general", mod: true, keys: ["K"] },
  { id: "newSnippet", section: "general", mod: true, alt: true, keys: ["N"] },
  { id: "createSnippet", section: "general", mod: true, keys: ["↵"] },
  { id: "openInEditor", section: "general", mod: true, shift: true, keys: ["↵"] },
  { id: "toggleSidebar", section: "general", mod: true, keys: ["B"] },
  { id: "help", section: "general", mod: true, keys: ["/"] },
  { id: "undoDelete", section: "general", mod: true, keys: ["Z"] },
  { id: "copyCurrent", section: "editor", mod: true, alt: true, keys: ["C"] },
  { id: "closeEditor", section: "editor", keys: ["Esc"] },
  { id: "navigateList", section: "navigation", keys: ["↑", "↓"] },
];

export const SHORTCUT_SECTION_ORDER: ShortcutSection[] = [
  "general",
  "editor",
  "navigation",
];

/** Look up a shortcut descriptor by id (throws if the id is unknown). */
export function getShortcut(id: ShortcutId): ShortcutDescriptor {
  const found = SHORTCUTS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown shortcut id: ${id}`);
  return found;
}

/** True when running on a Mac-family platform (uses ⌘ instead of Ctrl). */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Expand a descriptor into the ordered list of key tokens to render as `<kbd>`
 * badges, with the modifier symbols resolved for the current platform.
 */
export function formatShortcutKeys(d: ShortcutDescriptor, mac: boolean): string[] {
  const tokens: string[] = [];
  if (d.mod) tokens.push(mac ? "⌘" : "Ctrl");
  if (d.alt) tokens.push(mac ? "⌥" : "Alt");
  if (d.shift) tokens.push(mac ? "⇧" : "Shift");
  return [...tokens, ...d.keys];
}

/**
 * Whether the event target is a text-editing surface. Bare-key shortcuts are
 * skipped for these so typing is never hijacked.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // CodeMirror's editable surface lives inside `.cm-editor`.
  if (el.closest(".cm-editor")) return true;
  return false;
}
