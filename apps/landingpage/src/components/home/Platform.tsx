import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURES } from "@/components/home/features";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** A section's heading: a small grey label, the title, then the text (and a link). */
export function SectionHeading({
  eyebrow,
  title,
  body,
  id,
  children,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col items-start">
      {eyebrow && <p className="mb-3 text-[0.9375rem] text-muted">{eyebrow}</p>}
      <h2 id={id} className="text-[1.75rem] leading-[1.25] md:text-[2rem]">
        {title}
      </h2>
      {body && <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{body}</p>}
      {children}
    </div>
  );
}

/** What the product does: one section per feature, the screen that does it underneath. */
export function Platform({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  return (
    <div id="platform">
      {FEATURES.map((feature, index) => {
        const text = dict.features[index]!;
        const id = `feature-${index}`;
        return (
          <section key={text.label} aria-labelledby={id} className="border-t border-line">
            <div className="container-site py-20 md:py-28">
              <SectionHeading eyebrow={text.label} title={text.title} body={text.body} id={id}>
                {feature.path && (
                  <Link
                    href={`/${locale}/${feature.path}`}
                    className="group mt-4 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-strong transition-colors hover:text-muted"
                  >
                    {dict.platform.learnMore}
                    <span className="sr-only">: {text.title}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
                  </Link>
                )}
              </SectionHeading>
              <div className="relative mt-12 md:mt-16">
                {"desktop" in feature.shot ? (
                  <DesktopShot name={feature.shot.desktop} locale={locale} alt={dict.shots[feature.shot.desktop]} />
                ) : (
                  <div className="flex items-start justify-center gap-6 rounded-[6px] bg-panel px-6 py-12 sm:gap-12 md:py-16">
                    {feature.shot.phones.map((name, i) => (
                      <PhoneShot
                        key={name}
                        name={name}
                        locale={locale}
                        alt={dict.shots[name]}
                        className={`w-[42%] max-w-[280px] ${i === 1 ? "mt-14" : ""}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
