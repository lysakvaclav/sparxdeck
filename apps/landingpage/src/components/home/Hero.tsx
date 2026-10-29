import { ArrowRight } from "lucide-react";
import { HeroVisual } from "@/components/home/HeroVisual";
import { DesktopShot } from "@/components/site/Screenshot";
import { SITE } from "@/config/site";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** The top of the home page: the promise and the two ways in beside the drawing, then the product. */
export function Hero({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const hero = dict.hero;
  return (
    <section id="hero" className="relative overflow-hidden">
      <div className="container-site grid items-center gap-12 pt-32 md:pt-40 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pt-36">
        <div>
          <h1 className="rise text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[3.75rem] xl:text-[4rem]">
            {hero.title}
            <span className="block text-muted">{hero.titleMuted}</span>
          </h1>
          <p className="rise rise-delay-1 mt-8 max-w-xl text-base leading-relaxed text-main md:text-lg">{hero.body}</p>
          <div className="rise rise-delay-2 mt-10 flex flex-wrap gap-3">
            <a href={SITE.signupUrl} className="button button-primary">
              {hero.primary}
              <ArrowRight className="arrow" aria-hidden />
            </a>
            <a href={SITE.bookingUrl} className="button button-secondary">
              {hero.secondary}
            </a>
          </div>
          <p className="rise rise-delay-2 mt-5 text-sm text-muted">{hero.note}</p>
        </div>
        <div className="rise rise-delay-1 mx-auto aspect-square w-full max-w-[34rem] lg:-me-8">
          <HeroVisual />
        </div>
      </div>
      <div className="container-site rise rise-delay-3 relative mt-12 md:mt-16">
        <DesktopShot name="dashboard" locale={locale} alt={dict.shots.dashboard} priority />
        {/* The picture fades into the page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background via-background/70 to-transparent"
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
