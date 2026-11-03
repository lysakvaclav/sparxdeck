import type { Metadata } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE } from "@/config/site";

// Geist (SIL Open Font License, served from our own domain by next/font): a
// quiet grotesk with a variable weight, so headings can sit at a light 400
// and body text at 400 with 460 for emphasis. Armenian, Georgian and Arabic
// fall back to the system font, as before.
const geist = Geist({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "SparxDeck – revize požární techniky bez papíru",
    template: "%s | SparxDeck",
  },
  description:
    "SparxDeck je aplikace pro servisní firmy, které dělají revize hasicích přístrojů a dalších požárně bezpečnostních zařízení. QR štítky, kontrola na telefonu, automatický PDF protokol a hlídání termínů revizí.",
  keywords: [
    "SparxDeck",
    "revize hasicích přístrojů",
    "kontrola provozuschopnosti",
    "požární ochrana software",
    "revizní protokol",
    "evidence hasicích přístrojů",
    "QR štítky",
    "fire extinguisher inspection software",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "SparxDeck – revize požární techniky bez papíru",
    description:
      "Naskenujte QR štítek, odklikněte kontrolu a protokol s podpisem zákazníka je hotový ještě na místě. Aplikace pro servisní firmy v požární ochraně.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SparxDeck – revize požární techniky bez papíru",
    description:
      "QR štítky, kontrola na telefonu, automatický PDF protokol a hlídání termínů revizí.",
  },
  robots: { index: true, follow: true },
  // No canonical here: every page sets its own (src/lib/seo.ts). One inherited
  // canonical would tell search engines that all pages are copies of one.
  // Icons: favicon.ico, icon.png and apple-icon.png in src/app (Next.js file
  // conventions), generated from the mark by apps/platform/scripts/generate-app-icons.mjs.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`}>
        <ThemeProvider>
          {/* JSON-LD: Organization */}
          <Script id="ld-org" type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE.name,
              url: SITE.url,
              logo: `${SITE.url}/icon.png`,
              email: SITE.email,
              ...(SITE.social.linkedin ? { sameAs: [SITE.social.linkedin] } : {}),
            })}
          </Script>
          {/* JSON-LD: Website */}
          <Script id="ld-website" type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE.name,
              url: SITE.url,
            })}
          </Script>
          <div className="min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
