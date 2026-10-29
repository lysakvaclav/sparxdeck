import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE } from "@/config/site";

const helveticaNow = localFont({
  src: [
    {
      path: "../../public/helvetica-now-display/HelveticaNowDisplay-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/helvetica-now-display/HelveticaNowDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/helvetica-now-display/HelveticaNowDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const helveticaNowDisplay = localFont({
  src: [
    {
      path: "../../public/helvetica-now-display/HelveticaNowDisplay-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/helvetica-now-display/HelveticaNowDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-display",
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
    url: SITE.url,
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
  alternates: { canonical: "/" },
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
      <body className={`${helveticaNow.variable} ${helveticaNowDisplay.variable} antialiased`}>
        <ThemeProvider>
          {/* JSON-LD: Organization */}
          <Script id="ld-org" type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE.name,
              url: SITE.url,
              email: SITE.email,
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
