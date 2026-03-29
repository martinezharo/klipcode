"use client";

import { useEffect, useRef, useState } from "react";
import { Folder } from "lucide-react";
import { useAsideCtx } from "./AsideContext";
import { STEP } from "./utils";

export function NewFolderInput({ depth, parentId }: { depth: number; parentId: string | null }) {
  const { cancelCreateFolder, submitCreateFolder, copy } = useAsideCtx();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commit() {
    const name = value.trim();
    if (name) submitCreateFolder(parentId, name);
    else cancelCreateFolder();
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[5px] pr-2"
      style={{ paddingLeft: `${10 + depth * STEP}px` }}
    >
      <span className="w-[13px] shrink-0" />
      <Folder size={13} className="shrink-0 text-white/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancelCreateFolder();
        }}
        placeholder={copy.forms.folderName}
        className="min-w-0 flex-1 rounded bg-white/[0.07] px-2 py-0.5 text-[13px] text-foreground placeholder:text-white/20 outline-none ring-1 ring-white/15 focus:ring-white/35 transition-shadow"
      />
    </div>
  );
}
