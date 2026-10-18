import Link from "next/link";
import { cn } from "@/lib/utils";
import { TextLogo } from "./text-logo";

/** The text logo as a link home, as on the landing page. */
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="SparxDeck" className={cn("text-foreground", className)}>
      <TextLogo className="h-6" />
    </Link>
  );
}
