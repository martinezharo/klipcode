"use client";

import type { ReactNode } from "react";

/**
 * Shared presentational shell for the main-canvas views (FolderView, TrashView):
 * header with icon tile + title + meta, dashed empty state, and titled card grids.
 */

export function ViewHeader({
  icon,
  title,
  metaParts,
  actions,
}: {
  /** ~20px icon rendered inside the tile. */
  icon: ReactNode;
  title: string;
  /** Nullish entries are filtered out; the rest joined with " · ". */
  metaParts?: (string | null)[];
  /** Right-aligned action buttons (full-width row on mobile). */
  actions?: ReactNode;
}) {
  const meta = (metaParts ?? []).filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/[0.08] bg-ink/[0.04]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {meta.length > 0 && <p className="mt-0.5 text-sm text-muted">{meta.join(" · ")}</p>}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto">{actions}</div>
      )}
    </div>
  );
}

export function EmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink/[0.07] py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-ink/[0.08] bg-ink/[0.03]">
        {icon}
      </div>
      <p className="text-sm text-faint">{message}</p>
    </div>
  );
}

const GRID_CLASSES = {
  folders: "grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4",
  snippets: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
} as const;

export function CardSection({
  title,
  variant,
  children,
}: {
  title: string;
  variant: keyof typeof GRID_CLASSES;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">{title}</h2>
      <div className={GRID_CLASSES[variant]}>{children}</div>
    </section>
  );
}
