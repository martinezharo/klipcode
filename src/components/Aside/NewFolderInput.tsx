"use client";

import { Folder } from "lucide-react";

import { InlineNameInput } from "@/ui/InlineNameInput";
import { useAsideCtx } from "./AsideContext";
import { ROW_LEAD_SPACER, STEP } from "./utils";

export function NewFolderInput({ depth, parentId }: { depth: number; parentId: string | null }) {
  const { cancelCreateFolder, submitCreateFolder, copy } = useAsideCtx();

  return (
    <div
      className="flex items-center gap-1.5 pr-2 max-lg:h-11 lg:py-[5px]"
      style={{ paddingLeft: `${10 + depth * STEP}px` }}
    >
      <span className={ROW_LEAD_SPACER} />
      <Folder size={13} className="shrink-0 text-ink/30" />
      <InlineNameInput
        placeholder={copy.forms.folderName}
        onSubmit={(name) => submitCreateFolder(parentId, name)}
        onCancel={cancelCreateFolder}
        className="min-w-0 flex-1 rounded bg-ink/[0.07] px-2 py-0.5 text-[13px] text-foreground placeholder:text-faint outline-none ring-1 ring-ink/15 focus:ring-ink/35 transition-shadow"
      />
    </div>
  );
}
