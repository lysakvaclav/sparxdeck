import { cn } from "@/lib/utils";

/**
 * The SparxDeck mark: a coral triangle over a dark one. The dark triangle takes
 * the text colour, so the mark stays visible on dark surfaces.
 */
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="145 135 210 210"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable="false"
      className={cn("shrink-0 text-[#29333c] dark:text-[#e6e9ec]", className)}
    >
      <polygon points="145,135 145,240 250,240" fill="#fe544a" />
      <polygon points="250,240 355,240 355,345" fill="currentColor" />
    </svg>
  );
}
