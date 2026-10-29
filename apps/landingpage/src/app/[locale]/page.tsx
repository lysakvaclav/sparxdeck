import { Comparison, Cta, Faq } from "@/components/home/Closing";
import { Facts, Hero } from "@/components/home/Hero";
import { Platform } from "@/components/home/Platform";
import { Principles, Steps } from "@/components/home/Principles";
import { SiteShell } from "@/components/site/SiteShell";
import { getDictionary, type Locale } from "@/i18n/dictionary";

interface LocalePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleHome({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || "cs") as Locale;
  const dict = getDictionary(locale);
  const home = dict.home;

  return (
    <SiteShell locale={locale} dict={dict} path="">
      <Hero dict={home} locale={locale} />
      <Facts dict={home} />
      <Platform dict={home} locale={locale} />
      <Principles dict={home} />
      <Steps dict={home} />
      <Comparison dict={home} />
      <Faq dict={home} bookDemo={dict.header.bookDemo} />
      <Cta dict={home} />
    </SiteShell>
  );
}
