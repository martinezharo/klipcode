"use client";

import Image from "next/image";
import { ChevronsLeft, LogIn, LogOut } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { AccountUser } from "@/lib/types";
import { Tooltip } from "@/ui/Tooltip";
import { Spinner } from "@/ui/Spinner";

export function AsideHeader({
  user,
  authReady,
  copy,
  signingIn,
  signingOut,
  onSignIn,
  onSignOut,
  onCollapse,
}: {
  user: AccountUser | null;
  authReady: boolean;
  copy: Dictionary;
  signingIn: boolean;
  signingOut: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className="px-3.5 py-4">
      <div className="flex items-center gap-2">
        {!authReady && !user ? (
          /* Session check still resolving — placeholder with the same footprint
             as the sign-in button, so signed-in users don't see a "Sign in"
             flash while the session loads. */
          <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1 pl-1 pr-2" aria-hidden="true">
            <div className="h-[15px] w-[15px] shrink-0 animate-pulse rounded-full bg-ink/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
          </div>
        ) : user ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 p-1">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/10 ring-1 ring-ink/10">
              {user.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt={user.name || user.email || "Avatar"}
                  width={24}
                  height={24}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* An account can have no avatar (GitHub allows it), so fall back
                   to an initial instead of rendering a broken image. */
                <span aria-hidden="true" className="text-[10px] font-medium text-ink/60">
                  {(user.name || user.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-foreground">
                {user.name || user.email?.split("@")[0]}
              </span>
            </div>
            <Tooltip content={signingOut ? copy.auth.signingOut : copy.auth.signOut} placement="bottom">
              <button
                onClick={onSignOut}
                disabled={signingOut}
                className="shrink-0 rounded p-1 text-ink/25 transition-colors hover:bg-ink/10 hover:text-ink/60 disabled:cursor-default disabled:hover:bg-transparent"
                aria-label={signingOut ? copy.auth.signingOut : copy.auth.signOut}
                aria-busy={signingOut}
              >
                {signingOut ? <Spinner size={12} /> : <LogOut size={12} />}
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            disabled={signingIn}
            className="group flex min-w-0 flex-1 items-center gap-2.5 py-1 pl-1 pr-2 text-left transition-colors hover:text-foreground disabled:cursor-default"
            aria-busy={signingIn}
          >
            {signingIn ? (
              <Spinner size={15} className="shrink-0 text-ink/80" />
            ) : (
              <LogIn size={15} className="shrink-0 text-ink/60 group-hover:text-ink" />
            )}
            <span className="truncate text-[12px] font-medium text-foreground/80 group-hover:text-foreground">
              {signingIn ? copy.auth.signingIn : copy.auth.signIn}
            </span>
          </button>
        )}

        <Tooltip content={copy.aside.collapse} placement="bottom">
          <button
            type="button"
            data-sidebar-toggle="collapse"
            onClick={onCollapse}
            className="shrink-0 rounded-md p-1.5 text-ink/20 transition-colors hover:bg-ink/6 hover:text-ink/60"
            aria-label={copy.aside.collapse}
          >
            <ChevronsLeft size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
