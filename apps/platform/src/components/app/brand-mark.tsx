import { cn } from "@/lib/utils";

/**
 * The SparxDeck mark: a rounded square with an L cut out of it (the same path as
 * src/assets/brand/mark.svg). It takes the text colour, so it stays visible on
 * dark surfaces.
 */
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 440 440"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable="false"
      className={cn("shrink-0 text-foreground", className)}
    >
      <path
        fill="currentColor"
        d="M12 0H428A12 12 0 0 1 440 12V428A12 12 0 0 1 428 440H378V240H123V296H326V440H12A12 12 0 0 1 0 428V12A12 12 0 0 1 12 0Z"
      />
    </svg>
  );
}
