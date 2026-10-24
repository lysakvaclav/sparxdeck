import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/app/theme-provider";
import { RTL_LOCALES } from "@/i18n/config";
import "./globals.css";

// Same typeface as the landing page.
const helveticaNow = localFont({
  src: [
    { path: "../fonts/HelveticaNowDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/HelveticaNowDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/HelveticaNowDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-helvetica-now",
  display: "swap",
});

// The workspace typeface (self-hosted by Next.js, no request to Google at runtime).
const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    robots: { index: false, follow: false },
    // Home screen on the iPhone (Android reads the manifest).
    appleWebApp: { capable: true, title: "SparxDeck", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = (RTL_LOCALES as readonly string[]).includes(locale) ? "rtl" : "ltr";
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${helveticaNow.variable} ${roboto.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider nonce={nonce}>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
