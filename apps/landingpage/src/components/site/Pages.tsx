import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Cta } from "@/components/home/Closing";
import { FEATURES } from "@/components/home/features";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import { SiteShell } from "@/components/site/SiteShell";
import { getDictionary, isLocale, type Dictionary, type Locale } from "@/i18n/dictionary";

// The site's inner pages: the product's features, the company and the legal
// texts. All of them share the header, a heading under it and the footer.

export type PageParams = Promise<{ locale: string }>;

export async function pageLocale(params: PageParams): Promise<{ locale: Locale; dict: Dictionary }> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "cs";
  return { locale, dict: getDictionary(locale) };
}

/** The heading of an inner page, under the floating header. */
export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-0" />
      <div className="container-site relative pt-32 pb-14 md:pt-40 md:pb-20">
        {eyebrow && <p className="eyebrow rise">{eyebrow}</p>}
        <h1 className="rise rise-delay-1 mt-6 max-w-4xl text-4xl leading-[1.05] md:text-6xl">{title}</h1>
        {subtitle && (
          <p className="rise rise-delay-2 mt-6 max-w-2xl text-base leading-relaxed text-main md:text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}

/** Paragraphs of text in a readable column. */
export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="max-w-3xl space-y-5 text-base leading-relaxed text-main md:text-lg">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

/** A page about the company or a legal text. */
export function TextPage({
  locale,
  dict,
  path,
  eyebrow,
  title,
  subtitle,
  paragraphs,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  path: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  children?: React.ReactNode;
}) {
  return (
    <SiteShell locale={locale} dict={dict} path={path}>
      <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {(paragraphs?.length || children) && (
        <section className="border-b border-line">
          <div className="container-site space-y-12 py-16 md:py-24">
            {paragraphs && <Prose paragraphs={paragraphs} />}
            {children}
          </div>
        </section>
      )}
    </SiteShell>
  );
}

/** A page about one feature: its heading, the screen, the text, the other features. */
export function FeaturePage({ locale, dict, index }: { locale: Locale; dict: Dictionary; index: number }) {
  const feature = FEATURES[index]!;
  const text = dict.home.features[index]!;
  const page = dict.pages[feature.page!];
  const body = "body" in page ? page.body : [];
  const others = FEATURES.map((item, i) => ({ item, i })).filter(({ item, i }) => item.path && i !== index);

  return (
    <SiteShell locale={locale} dict={dict} path={feature.path!}>
      <PageHero eyebrow={text.label} title={page.heading} subtitle={page.subheading} />
      <section className="border-b border-line">
        <div className="container-site py-14 md:py-20">
          {"desktop" in feature.shot ? (
            <DesktopShot name={feature.shot.desktop} locale={locale} alt={dict.home.shots[feature.shot.desktop]} priority />
          ) : (
            <div className="flex items-start justify-center gap-5 bg-surface px-6 py-10 sm:gap-10 md:py-16">
              {feature.shot.phones.map((name, i) => (
                <PhoneShot
                  key={name}
                  name={name}
                  locale={locale}
                  alt={dict.home.shots[name]}
                  priority
                  className={`w-[44%] max-w-[280px] ${i === 1 ? "mt-12" : ""}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="border-b border-line">
        <div className="container-site grid gap-10 py-16 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-2xl leading-tight md:text-3xl">{text.title}</h2>
          </div>
          <div className="lg:col-span-8">
            <Prose paragraphs={body} />
          </div>
        </div>
      </section>
      <section aria-labelledby="more-features" className="border-b border-line">
        <div className="container-site py-16 md:py-20">
          <p id="more-features" className="eyebrow">
            {dict.header.product}
          </p>
          <ul className="mt-8 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {others.map(({ item, i }) => (
              <li key={item.path} className="bg-background">
                <Link
                  href={`/${locale}/${item.path}`}
                  className="group flex h-full min-h-32 flex-col justify-between gap-6 p-5 transition-colors hover:bg-surface"
                >
                  <span className="text-base font-medium text-strong">{dict.home.features[i]!.title}</span>
                  <span className="inline-flex items-center gap-2 text-sm text-muted group-hover:text-strong">
                    {dict.home.features[i]!.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Cta dict={dict.home} />
    </SiteShell>
  );
}

/** The page's title in the browser tab and in search results. */
export function pageMetadata(title: string, description?: string) {
  return { title, ...(description ? { description } : {}) };
}
