import { ArrowRight } from "lucide-react";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import { SITE } from "@/config/site";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** The top of the home page: the promise, the two ways in, the product itself. */
export function Hero({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const hero = dict.hero;
  return (
    <section id="hero" className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-0" />
      <div className="container-site relative pt-32 pb-16 md:pt-44 md:pb-24">
        <p className="eyebrow rise">{hero.eyebrow}</p>
        <h1 className="rise rise-delay-1 mt-6 max-w-5xl text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[5.25rem]">
          {hero.title}
          <span className="block text-muted">{hero.titleMuted}</span>
        </h1>
        <p className="rise rise-delay-2 mt-7 max-w-2xl text-base leading-relaxed text-main md:text-lg">{hero.body}</p>
        <div className="rise rise-delay-2 mt-9 flex flex-wrap items-center gap-3">
          <a href={SITE.signupUrl} className="button button-primary">
            {hero.primary}
            <ArrowRight className="arrow" aria-hidden />
          </a>
          <a href={SITE.bookingUrl} className="button button-secondary">
            {hero.secondary}
          </a>
        </div>
        <p className="rise rise-delay-2 mt-4 text-sm text-muted">{hero.note}</p>

        <div className="rise rise-delay-3 relative mt-16 md:mt-20">
          <DesktopShot name="dashboard" locale={locale} alt={dict.shots.dashboard} priority />
          <PhoneShot
            name="check"
            locale={locale}
            alt={dict.shots.check}
            priority
            className="absolute -bottom-10 end-4 hidden w-[19%] min-w-[180px] md:block lg:end-10"
          />
        </div>
      </div>
    </section>
  );
}

/** Four plain facts about the product, without invented numbers. */
export function Facts({ dict }: { dict: HomeDictionary }) {
  return (
    <section aria-label={dict.platform.eyebrow} className="border-b border-line">
      <div className="container-site">
        {/* Hairlines between the cells: the grid's gap over the line colour. */}
        <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {dict.facts.map((fact) => (
            <div key={fact.value} className="flex flex-col gap-2 bg-background px-1 py-8 sm:px-6 lg:py-10">
              <dt className="order-2 text-sm leading-snug text-muted">{fact.label}</dt>
              <dd className="order-1 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-strong md:text-3xl">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
