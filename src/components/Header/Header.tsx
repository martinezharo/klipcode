"use client";

import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import type { Dictionary } from "@/i18n";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

interface HeaderProps {
  user: User | null;
  authReady: boolean;
  supabaseConfigured: boolean;
  copy: Dictionary;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  user,
  authReady,
  supabaseConfigured,
  copy,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  if (!authReady) return null;

  if (user) {
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={onSignOut}
          className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface px-1 py-1 transition-colors hover:border-white/20 hover:bg-surface-hover"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
              {(user.email?.[0] ?? "U").toUpperCase()}
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        type="button"
        disabled={!supabaseConfigured}
        onClick={onSignIn}
        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-white/20 hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <GitHubIcon size={16} />
        <span>{copy.auth.signIn}</span>
      </button>
    </div>
  );
}
