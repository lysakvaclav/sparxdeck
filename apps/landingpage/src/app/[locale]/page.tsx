import { Comparison, Cta, Faq } from "@/components/home/Closing";
import { Facts, Hero, Statement } from "@/components/home/Hero";
import { Mcp } from "@/components/home/Mcp";
import { Platform } from "@/components/home/Platform";
import { Principles } from "@/components/home/Principles";
import { SiteShell } from "@/components/site/SiteShell";
import type { Metadata } from "next";
import { getDictionary, isLocale, type Locale } from "@/i18n/dictionary";
import { seoMetadata } from "@/lib/seo";

interface LocalePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "cs";
  const hero = getDictionary(locale).home.hero;
  return seoMetadata({
    locale,
    path: "",
    title: `SparxDeck – ${hero.title.replace(/[.。։]$/u, "")}`,
    description: hero.body,
    absoluteTitle: true,
  });
}

export default async function LocaleHome({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || "cs") as Locale;
  const dict = getDictionary(locale);
  const home = dict.home;

  return (
    <SiteShell locale={locale} dict={dict}>
      <Hero dict={home} locale={locale} />
      <Facts dict={home} />
      <Statement dict={home} />
      <Principles dict={home} />
      <Platform dict={home} locale={locale} />
      <Mcp dict={home} />
      <Comparison dict={home} />
      <Faq dict={home} bookDemo={dict.header.bookDemo} />
      <Cta dict={home} />
    </SiteShell>
  );
}
