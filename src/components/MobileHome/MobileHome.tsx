"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Clock, LogIn, LogOut, RotateCcw, Settings, Trash2 } from "lucide-react";

import { ContextMenu } from "@/components/ContextMenu/ContextMenu";
import { WorkspaceTree } from "@/components/Workspace/WorkspaceTree";
import { Spinner } from "@/ui/Spinner";

import type { MobileHomeProps } from "./types";
import { RecentsStrip } from "./RecentsStrip";
import { MobileBottomBar } from "./MobileBottomBar";

/**
 * The workspace as a full-screen destination, for touch layouts.
 *
 * This replaces the sliding drawer below `lg`. The drawer was the desktop panel
 * translated over the canvas, which is why every control in it was sized for a
 * mouse; here the tree owns the screen, and the two actions that matter most
 * (search, create) live in a bar under the thumb instead of at the top.
 *
 * The tree itself is {@link WorkspaceTree}, shared verbatim with the aside.
 */
export function MobileHome({
  user,
  authReady,
  copy,
  onOpenSearch,
  onOpenPreferences,
  onSignIn,
  onSignOut,
  signingIn,
  signingOut,
  onOpenTrash,
  onRestoreAll,
  onEmptyTrash,
  trashCount,
  ...treeProps
}: MobileHomeProps) {
  const [accountMenu, setAccountMenu] = useState<{ x: number; y: number } | null>(null);

  function openAccountMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setAccountMenu({ x: rect.left, y: rect.bottom + 6 });
  }

  const accountLabel = user
    ? (user.name ?? user.email ?? copy.auth.signOut)
    : signingIn
      ? copy.auth.signingIn
      : copy.auth.signIn;

  return (
    <>
      {accountMenu && (
        <ContextMenu
          x={accountMenu.x}
          y={accountMenu.y}
          groups={[
            {
              items: [
                {
                  id: "preferences",
                  label: copy.aside.preferences,
                  Icon: Settings,
                  onClick: onOpenPreferences,
                },
                {
                  id: "trash",
                  label:
                    trashCount > 0 ? `${copy.aside.trash} (${trashCount})` : copy.aside.trash,
                  Icon: Trash2,
                  onClick: onOpenTrash,
                },
              ],
            },
            // Bulk trash actions only make sense with something in it.
            ...(trashCount > 0
              ? [
                  {
                    items: [
                      {
                        id: "restore-all",
                        label: copy.trash.restoreAll,
                        Icon: RotateCcw,
                        onClick: onRestoreAll,
                      },
                      {
                        id: "empty-trash",
                        label: copy.trash.emptyTrash,
                        Icon: Trash2,
                        variant: "destructive" as const,
                        onClick: onEmptyTrash,
                      },
                    ],
                  },
                ]
              : []),
            {
              items: user
                ? [
                    {
                      id: "sign-out",
                      label: signingOut ? copy.auth.signingOut : copy.auth.signOut,
                      Icon: LogOut,
                      onClick: onSignOut,
                      disabled: signingOut,
                    },
                  ]
                : [
                    {
                      id: "sign-in",
                      label: signingIn ? copy.auth.signingIn : copy.auth.signIn,
                      Icon: LogIn,
                      onClick: onSignIn,
                      disabled: signingIn,
                    },
                  ],
            },
          ]}
          onClose={() => setAccountMenu(null)}
        />
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="flex h-dvh flex-col overflow-hidden bg-surface focus:outline-none"
      >
        <h1 className="sr-only">{copy.aside.mySpace}</h1>

        {/* ── Account + strip label ── */}
        <header className="flex shrink-0 items-center justify-between px-3 py-1.5">
          <button
            type="button"
            onClick={openAccountMenu}
            aria-haspopup="menu"
            aria-expanded={accountMenu !== null}
            aria-label={accountLabel}
            className="flex h-11 items-center gap-1 rounded-lg px-1 transition-colors active:bg-ink/6"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/10 ring-1 ring-ink/10">
              {!authReady ? (
                <span aria-hidden="true" className="h-full w-full animate-pulse bg-ink/10" />
              ) : signingIn || signingOut ? (
                <Spinner size={13} />
              ) : user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* An account can have no avatar (GitHub allows it), and signed
                   out there is no name at all — fall back to a glyph rather
                   than rendering a broken image. */
                <span aria-hidden="true" className="text-[11px] font-medium text-ink/60">
                  {user ? (user.name || user.email || "?").charAt(0).toUpperCase() : "?"}
                </span>
              )}
            </span>
            <ChevronDown size={14} className="text-ink/30" />
          </button>

          <span className="flex items-center gap-1 rounded-full bg-ink/6 px-2.5 py-1 text-[11px] text-muted">
            <Clock size={11} />
            {copy.mobileHome.recents}
          </span>
        </header>

        <RecentsStrip
          snippets={treeProps.snippets}
          copy={copy}
          onSelectSnippet={treeProps.onSelectSnippet}
        />

        <WorkspaceTree copy={copy} {...treeProps} />

        <MobileBottomBar
          copy={copy}
          onOpenSearch={onOpenSearch}
          onCreateSnippet={() => treeProps.onOpenCreateModal(null)}
        />
      </main>
    </>
  );
}
