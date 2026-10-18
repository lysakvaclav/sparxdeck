import type { CSSProperties } from "react";
import logo from "@/assets/brand/text-logo.png";

/**
 * The SparxDeck text logo in the current text colour. The image is a mask, so
 * it follows the light and dark theme exactly; size it by height (e.g. h-6).
 * `aspect-square` shows only the mark (narrow screens). Decorative unless given
 * a label (a link around it usually names it).
 */
export function TextLogo({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  const mask = `url(${logo.src}) left center / auto 100% no-repeat`;
  return (
    <span
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
      className={`block shrink-0 bg-current aspect-(--logo-ratio) ${className}`}
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
