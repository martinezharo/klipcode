"use client";

import { useCallback, useEffect, useRef } from "react";

/** Elements that can receive focus inside a dialog panel. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // offsetParent is null for display:none subtrees; position:fixed nodes report
    // null too, so fall back to a rect check for those.
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

interface UseDialogA11yOptions {
  /** Invoked on Escape and used by callers for backdrop clicks. */
  onClose: () => void;
  /**
   * Where focus goes when the dialog opens. Defaults to the first focusable
   * element, falling back to the panel itself (which is made programmatically
   * focusable) so focus never stays behind the modal.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Set to false for dialogs that own their own Escape handling (e.g. a palette
   * that must first dismiss an inner popup). Defaults to true.
   */
  closeOnEscape?: boolean;
}

/**
 * Shared modal-dialog behaviour: Escape to close, a Tab/Shift+Tab focus trap,
 * initial focus inside the panel and focus restoration to whatever was focused
 * before the dialog opened (WCAG 2.1.2 "No Keyboard Trap" and 2.4.3 "Focus
 * Order").
 *
 * Every dialog in the app previously hand-rolled its own Escape listener and
 * none of them trapped or restored focus, so keyboard users tabbed straight out
 * of the modal into the page behind it. Returns the ref to spread onto the
 * dialog panel element.
 */
export function useDialogA11y({
  onClose,
  initialFocusRef,
  closeOnEscape = true,
}: UseDialogA11yOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the key listener effect, so a
  // caller passing an inline arrow doesn't reattach on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /* Move focus into the dialog on mount, and back out on unmount. */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else if (panel) {
      const [first] = focusableWithin(panel);
      if (first) first.focus();
      else panel.focus();
    }

    return () => {
      // The trigger may have unmounted with the dialog (e.g. a row that was
      // deleted); only restore when it is still in the document.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // Mount/unmount only — the initial focus target is read once, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Escape to close + Tab cycling confined to the panel. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = focusableWithin(panel);
      if (focusable.length === 0) {
        // Nothing to tab to — keep focus pinned to the panel rather than
        // letting it escape to the page behind the modal.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Capture phase so the dialog wins over the app's global shortcut handlers.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [closeOnEscape]);

  return panelRef;
}

/**
 * Roving-focus keyboard navigation for a popup menu (`role="menu"`). Focuses the
 * first item on open, moves focus with the arrow keys / Home / End, closes on
 * Escape and restores focus to the trigger — the menu is portalled to
 * `document.body`, so without this it sits outside the tab order entirely.
 */
export function useMenuKeyboardNav(onClose: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const items = useCallback(
    () =>
      menuRef.current
        ? Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
        : [],
    [],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const [first] = items();
    first?.focus();
    return () => {
      // Several menu items open something that takes focus itself (a rename
      // input, a dialog). Restoring the trigger synchronously would blur it —
      // and a rename input commits on blur. Defer, then only restore if nothing
      // else claimed focus after the menu went away.
      queueMicrotask(() => {
        const active = document.activeElement;
        if (active && active !== document.body) return;
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    };
  }, [items]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      const all = items();
      if (all.length === 0) return;

      const index = all.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;

      if (e.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % all.length;
      else if (e.key === "ArrowUp") next = index < 0 ? all.length - 1 : (index - 1 + all.length) % all.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = all.length - 1;
      else if (e.key === "Tab") {
        // Tabbing away from a menu closes it, matching native menu behaviour.
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      all[next].focus();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [items]);

  return menuRef;
}
