import Link from "next/link";
import { cn } from "@/lib/utils";

/** Text wordmark, as on the landing page. */
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("font-display text-xl leading-none tracking-tight text-foreground", className)}
    >
      SparxDeck
    </Link>
  );
}
