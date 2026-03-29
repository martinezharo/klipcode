"use client";

import { FileCode2, Pin, PinOff } from "lucide-react";
import { LANGUAGES } from "@/lib/constants/languages";
import type { SnippetRecord } from "@/lib/types";
import { useAsideCtx } from "./AsideContext";
import { ItemActions } from "./ItemActions";
import { STEP } from "./utils";

export function SnippetNode({ snippet, depth }: { snippet: SnippetRecord; depth: number }) {
  const ctx = useAsideCtx();
  const isRenaming = ctx.renamingId === snippet.id;

  const ext = LANGUAGES.find((l) => l.id === snippet.language)?.extension ?? "";
  const baseName = snippet.title || ctx.copy.snippetCard.untitled;
  const displayName = baseName.endsWith(ext) ? baseName : `${baseName}${ext}`;

  const paddingLeft = 10 + depth * STEP + 19;
  const isDraggingThis = ctx.dragging?.id === snippet.id;
  const sharedRowClass = [
    "group flex w-full items-center gap-1.5 rounded-md py-[5px] pr-2 text-left text-[13px] text-muted transition-all duration-100 hover:bg-white/[0.04] hover:text-foreground",
    isDraggingThis ? "opacity-40" : "",
  ].filter(Boolean).join(" ");

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    ctx.openMenu({ type: "snippet", id: snippet.id, x: e.clientX, y: e.clientY });
  }

  function openMoreMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.openMenu({ type: "snippet", id: snippet.id, x: rect.left, y: rect.bottom + 4 });
  }

  return isRenaming ? (
    <div
      className={sharedRowClass}
      style={{ paddingLeft }}
      onContextMenu={openContextMenu}
    >
      <FileCode2 size={13} className="shrink-0 text-white/20" />
      <input
        autoFocus
        defaultValue={snippet.title ?? ""}
        onBlur={(e) => ctx.submitSnippetRename(snippet.id, e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter")
            ctx.submitSnippetRename(snippet.id, (e.target as HTMLInputElement).value);
          if (e.key === "Escape") ctx.cancelRename();
        }}
        className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
      />
    </div>
  ) : (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ctx.selectSnippet(snippet.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.selectSnippet(snippet.id);
        }
      }}
      onContextMenu={openContextMenu}
      className={sharedRowClass}
      style={{ paddingLeft }}
    >
      <span
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          ctx.startDrag("snippet", snippet.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => ctx.endDrag()}
        className="flex min-w-0 flex-1 items-center gap-1.5 cursor-grab active:cursor-grabbing"
      >
        <FileCode2 size={13} className="shrink-0 text-white/20" />
        <span className="flex-1 truncate leading-none">{displayName}</span>
      </span>
      <ItemActions onMore={openMoreMenu} />
      {snippet.isPinnedAside && (
        <span
          role="button"
          title={ctx.copy.aside.unpin}
          className="group/pin shrink-0 rounded p-px text-white/30 transition-colors hover:text-white/70"
          onClick={(e) => {
            e.stopPropagation();
            void ctx.pinSnippet(snippet.id, "aside", false);
          }}
        >
          <Pin size={10} className="block group-hover/pin:hidden" />
          <PinOff size={10} className="hidden group-hover/pin:block" />
        </span>
      )}
    </div>
  );
}
