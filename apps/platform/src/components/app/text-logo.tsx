import type { CSSProperties } from "react";
import logo from "@/assets/brand/text-logo.png";
import { cn } from "@/lib/utils";

/**
 * The SparxDeck text logo in the current text colour (white on the rail). The
 * image is a mask, so one file serves any background; it is bundled into
 * /_next/static, which the service worker keeps for work without a signal.
 * Size it by height (e.g. h-4); the width follows, `aspect-square` shows only the mark.
 */
export function TextLogo({ className, label }: { className?: string; label?: string }) {
  const mask = `url(${logo.src}) left center / auto 100% no-repeat`;
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("block aspect-(--logo-ratio) shrink-0 bg-current", className)}
      style={
        {
          "--logo-ratio": `${logo.width} / ${logo.height}`,
          mask,
          WebkitMask: mask,
        } as CSSProperties
      }
    />
  );
}
