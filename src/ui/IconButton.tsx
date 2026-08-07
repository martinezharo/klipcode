import { forwardRef } from "react";

import { TOUCH_TARGET } from "@/lib/constants/layout";

/**
 * An icon-only button whose hit area is finger-sized on touch while its visible
 * box stays compact.
 *
 * Every icon control should go through this rather than hand-rolling padding:
 * the aside once shipped 16-24px targets because each one picked its own `p-1`
 * / `p-1.5`, and there was nowhere to fix them all at once.
 *
 * The 44px region comes from an invisible `::after` (see `TOUCH_TARGET`), so
 * making a control reachable never costs layout space. Because those regions
 * are invisible they can silently overlap — keep adjacent icon buttons at least
 * 44px apart centre-to-centre.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={[
        "flex shrink-0 items-center justify-center rounded-md transition-colors",
        // A visible box that is comfortable to aim at without being bulky; the
        // real target is the wider invisible one.
        "max-lg:h-8 max-lg:w-8",
        TOUCH_TARGET,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
