import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURES } from "@/components/home/features";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/** A section's heading: the title on one side, the text (and a link) on the other. */
export function SectionHeading({
  title,
  body,
  id,
  children,
}: {
  title: string;
  body?: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-20">
      <h2 id={id} className="text-4xl leading-[1.05] md:text-5xl lg:text-[3.5rem]">
        {title}
      </h2>
      {(body || children) && (
        <div className="lg:pt-2">
          {body && <p className="text-lg leading-snug text-main md:text-[1.4rem] md:leading-[1.35]">{body}</p>}
          {children}
        </div>
      )}
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
            <div className="container-site py-24 md:py-32">
              <SectionHeading title={text.title} body={text.body} id={id}>
                {feature.path && (
                  <Link
                    href={`/${locale}/${feature.path}`}
                    className="group mt-6 inline-flex min-h-11 items-center gap-2 text-base text-muted transition-colors hover:text-strong"
                  >
                    {dict.platform.learnMore}
                    <span className="sr-only">: {text.title}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
                  </Link>
                )}
              </SectionHeading>
              <div className="relative mt-14 md:mt-20">
                {"desktop" in feature.shot ? (
                  <DesktopShot name={feature.shot.desktop} locale={locale} alt={dict.shots[feature.shot.desktop]} />
                ) : (
                  <div className="flex items-start justify-center gap-6 rounded-3xl border border-line bg-surface px-6 py-12 sm:gap-12 md:py-16">
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
