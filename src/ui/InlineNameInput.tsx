"use client";

import { useState } from "react";

/**
 * A single-use text field for naming something inline: commit on Enter or blur,
 * abandon on Escape, and treat an empty value as "never mind" rather than as a
 * blank name.
 *
 * Both workspace shells create folders this way — the desktop tree as an
 * indented row, the mobile feed as a card — and the rule that a whitespace-only
 * name cancels instead of creating `""` is the kind of thing that must not exist
 * in two places. Only the chrome differs, which is what `className` is for.
 */
export function InlineNameInput({
  placeholder,
  className,
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  className?: string;
  /** Called with the trimmed, non-empty value. */
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  function commit() {
    const name = value.trim();
    if (name) onSubmit(name);
    else onCancel();
  }

  return (
    <input
      autoFocus
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // The tree binds workspace shortcuts (delete, copy, select-all) on an
        // ancestor; none of them may fire while a name is being typed.
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}
