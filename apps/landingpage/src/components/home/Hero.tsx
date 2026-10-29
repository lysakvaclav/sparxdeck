import { ArrowRight } from "lucide-react";
import { DesktopShot } from "@/components/site/Screenshot";
import { SITE } from "@/config/site";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** The top of the home page: the promise, one way in, the product itself. */
export function Hero({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const hero = dict.hero;
  return (
    <section id="hero" className="relative">
      <div className="container-site pt-40 md:pt-52">
        <h1 className="rise max-w-5xl text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[5rem]">{hero.title}</h1>
        <p className="rise rise-delay-1 mt-8 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{hero.body}</p>
        <a href={SITE.bookingUrl} className="rise rise-delay-2 button button-primary button-lg mt-10">
          {hero.cta}
          <ArrowRight className="arrow" aria-hidden />
        </a>
      </div>
      <div className="container-site rise rise-delay-3 relative mt-16 md:mt-24">
        <DesktopShot name="dashboard" locale={locale} alt={dict.shots.dashboard} priority />
        {/* The picture fades into the page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background via-background/70 to-transparent"
        />
      </div>
    </section>
  );
}

/** Plain facts about the product in a quiet row, without invented numbers. */
export function Facts({ dict }: { dict: HomeDictionary }) {
  return (
    <section aria-label={dict.platform.eyebrow}>
      <dl className="container-site grid grid-cols-2 gap-x-8 gap-y-10 py-16 md:py-20 lg:grid-cols-4">
        {dict.facts.map((fact) => (
          <div key={fact.value} className="flex flex-col gap-2">
            <dt className="order-2 max-w-[16rem] text-sm leading-snug text-muted">{fact.label}</dt>
            <dd className="order-1 font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-strong md:text-2xl">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One large statement: the first sentence bright, the rest muted. */
export function Statement({ dict }: { dict: HomeDictionary }) {
  return (
    <section aria-label={dict.platform.eyebrow} className="border-t border-line">
      <p className="container-site py-24 font-[family-name:var(--font-display)] text-3xl leading-[1.12] font-medium tracking-tight text-muted md:py-36 md:text-5xl lg:text-[3.5rem]">
        <span className="text-strong">{dict.platform.title}</span> {dict.platform.body}
      </p>
    </section>
  );
}
