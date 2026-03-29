"use client";

import { ChevronsLeft, LogOut } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { User } from "@supabase/supabase-js";
import { GitHubIcon } from "./GitHubIcon";

export function AsideHeader({
  user,
  copy,
  onSignIn,
  onSignOut,
  onCollapse,
}: {
  user: User | null;
  copy: Dictionary;
  onSignIn: () => void;
  onSignOut: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className="px-3.5 py-4">
      <div className="flex items-center gap-2">
        {user ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 p-1">
            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || user.email || "Avatar"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12px] font-medium text-foreground">
                {user.user_metadata.full_name || user.email?.split("@")[0]}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="shrink-0 rounded p-1 text-white/25 transition-colors hover:bg-white/[0.1] hover:text-white/60"
              title={copy.auth.signOut}
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="group flex min-w-0 flex-1 items-center gap-2.5 py-1 pl-1 pr-2 text-left transition-colors hover:text-foreground"
          >
            <GitHubIcon size={16} className="text-white/80 group-hover:text-white" />
            <span className="truncate text-[12px] font-medium text-foreground/80 group-hover:text-foreground ml-2">
              {copy.auth.signIn}
            </span>
          </button>
        )}

        <button
          type="button"
          title={copy.aside.collapse}
          onClick={onCollapse}
          className="shrink-0 rounded-md p-1.5 text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/60"
        >
          <ChevronsLeft size={14} />
        </button>
      </div>
    </div>
  );
}
