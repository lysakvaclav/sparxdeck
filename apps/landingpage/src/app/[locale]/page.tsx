import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { CompaniesSection } from "@/components/sections/CompaniesSection";
import { ComparisonSection } from "@/components/sections/ComparisonSection";
import { RadarShowcaseSection } from "@/components/sections/RadarShowcaseSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { GetStartedSection } from "@/components/sections/GetStartedSection";
import { ParticleWordmarkSection } from "@/components/sections/ParticleWordmarkSection";
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

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header locale={locale} dict={dict.header} />
      <HeroSection dict={dict.hero} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 pb-16 md:px-8 lg:px-12 mt-24">
        <CompaniesSection dict={dict.companies} locale={locale} />
        <ComparisonSection dict={dict.comparison} />
        <RadarShowcaseSection dict={dict.radar} />
        <FaqSection dict={dict.faq} />
        <GetStartedSection dict={dict.getStarted} />
      </main>
      <Footer locale={locale} dict={dict.footer} />
      <ParticleWordmarkSection />
    </div>
  );
}
