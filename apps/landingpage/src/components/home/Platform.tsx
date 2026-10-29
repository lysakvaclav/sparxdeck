import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURES } from "@/components/home/features";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** A section's heading: the label and title on one side, the text on the other. */
export function SectionHeading({
  eyebrow,
  title,
  body,
  id,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  id: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-5 text-3xl leading-[1.08] md:text-5xl">
          {title}
        </h2>
      </div>
      {body && <p className="self-end text-base leading-relaxed text-main md:text-lg">{body}</p>}
    </div>
  );
}

/** What the product does: one row per feature, with the screen that does it. */
export function Platform({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const p = dict.platform;
  return (
    <section aria-labelledby="platform-title" id="platform" className="border-b border-line">
      <div className="container-site py-20 md:py-28">
        <SectionHeading eyebrow={p.eyebrow} title={p.title} body={p.body} id="platform-title" />
        <ol className="mt-16 md:mt-20">
          {FEATURES.map((feature, index) => {
            const text = dict.features[index]!;
            const flipped = index % 2 === 1;
            return (
              <li
                key={text.label}
                className="grid items-center gap-10 border-t border-line py-14 md:py-20 lg:grid-cols-12 lg:gap-14"
              >
                <div className={`lg:col-span-4 ${flipped ? "lg:order-2" : ""}`}>
                  <p className="mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")} <span aria-hidden>/</span> {String(FEATURES.length).padStart(2, "0")}
                  </p>
                  <p className="eyebrow mt-4">{text.label}</p>
                  <h3 className="mt-4 text-2xl leading-tight md:text-3xl">{text.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-main">{text.body}</p>
                  {feature.path && (
                    <Link
                      href={`/${locale}/${feature.path}`}
                      className="group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-strong"
                    >
                      {p.learnMore}
                      <span className="sr-only">: {text.title}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
                    </Link>
                  )}
                </div>
                <div className={`lg:col-span-8 ${flipped ? "lg:order-1" : ""}`}>
                  {"desktop" in feature.shot ? (
                    <DesktopShot name={feature.shot.desktop} locale={locale} alt={dict.shots[feature.shot.desktop]} />
                  ) : (
                    <div className="flex items-start justify-center gap-5 bg-surface px-6 py-10 sm:gap-8 md:py-14">
                      <PhoneShot
                        name={feature.shot.phones[0]}
                        locale={locale}
                        alt={dict.shots[feature.shot.phones[0]]}
                        className="w-[44%] max-w-[260px]"
                      />
                      <PhoneShot
                        name={feature.shot.phones[1]}
                        locale={locale}
                        alt={dict.shots[feature.shot.phones[1]]}
                        className="mt-12 w-[44%] max-w-[260px]"
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
