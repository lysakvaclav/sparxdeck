import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DesktopShot } from "@/components/site/Screenshot";
import { SITE } from "@/config/site";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/**
 * The top of the home page: a short announcement, a small tile, then one long
 * heading whose first sentence is bright and the rest faint, the button and a
 * plain link beside it. The product itself underneath.
 */
export function Hero({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const hero = dict.hero;
  return (
    <section id="hero" className="relative">
      <div className="container-site pt-28 md:pt-36">
        <Link href={`/${locale}/mcp`} className="rise news-chip">
          <span>{hero.news}</span>
          <span className="text-muted">{hero.newsTag}</span>
          <ArrowRight aria-hidden />
        </Link>
        <div aria-hidden className="rise rise-delay-1 hero-tile mx-auto mt-24 md:mt-40" />
        <h1 className="rise rise-delay-1 mt-10 max-w-[70rem] text-[2rem] leading-[1.22] tracking-[-0.02em] sm:text-[2.5rem] lg:text-[3rem]">
          {hero.title} <span className="text-faint">{hero.rest}</span>
        </h1>
        <div className="rise rise-delay-2 mt-12 flex flex-wrap items-center gap-x-8 gap-y-3">
          <a href={SITE.bookingUrl} className="button button-primary button-lg">
            {hero.cta}
            <ArrowRight className="arrow" aria-hidden />
          </a>
          <a href="#platform" className="text-link">
            {hero.secondary}
          </a>
        </div>
      </div>
      <div className="container-site rise rise-delay-3 relative mt-20 md:mt-28">
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
            <dd className="order-1 text-xl tracking-[-0.01em] text-strong md:text-2xl">
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
      <p className="container-site py-24 text-[2rem] leading-[1.22] tracking-[-0.02em] text-faint md:py-36 md:text-[2.5rem] lg:text-[3rem]">
        <span className="text-strong">{dict.platform.title}</span> {dict.platform.body}
      </p>
    </section>
  );
}
