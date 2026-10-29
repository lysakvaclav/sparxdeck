import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/**
 * hreflang codes for search engines. They accept ISO 639-1 languages only, so
 * Montenegrin (cnr) is marked as Serbian for Montenegro.
 */
const HREFLANG: Partial<Record<Locale, string>> = { cnr: "sr-ME" };

export function hreflangOf(locale: Locale): string {
  return HREFLANG[locale] ?? locale;
}

/** A page's address in one language; path is "" for the home page or "/about" etc. */
export function pageUrl(locale: Locale, path: string): string {
  return `${SITE.url}/${locale}${path}`;
}

/** Every language version of a page (reciprocal), plus x-default for other languages. */
export function languagesOf(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[hreflangOf(locale)] = pageUrl(locale, path);
  languages["x-default"] = pageUrl(defaultLocale, path);
  return languages;
}

/** The share image (src/app/opengraph-image.png): the text logo on the site's dark. */
const SHARE_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: SITE.name };

/**
 * A page's metadata: its own canonical address (never the bare domain, which
 * redirects), its language versions and the texts for sharing.
 */
export function seoMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description?: string;
  /** The home page's title stands alone, without the "| SparxDeck" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const url = pageUrl(locale, path);
  const shareTitle = absoluteTitle ? title : `${title} | ${SITE.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    ...(description ? { description } : {}),
    alternates: { canonical: url, languages: languagesOf(path) },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      url,
      locale: hreflangOf(locale),
      title: shareTitle,
      ...(description ? { description } : {}),
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      ...(description ? { description } : {}),
      images: [SHARE_IMAGE.url],
    },
  };
}
