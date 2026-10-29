import Link from "next/link";
import { TextLogo } from "@/components/ui/text-logo";

/** Any unknown address: in the site's look (Next's default page is black on the dark theme). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <TextLogo label="SparxDeck" className="h-8 text-strong" />
      <h1 className="text-6xl md:text-7xl">404</h1>
      <p className="text-base text-muted">Stránka nenalezena · Page not found</p>
      <Link href="/" className="button button-secondary">
        SparxDeck
      </Link>
    </main>
  );
}
