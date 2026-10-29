"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURES } from "@/components/home/features";
import { DesktopShot, PhoneShot } from "@/components/site/Screenshot";
import type { HomeDictionary, Locale } from "@/i18n/dictionary";

/**
 * The platform's real screens behind one bar of tabs, so the page doesn't go
 * on for six screens. Tabs follow the ARIA pattern (arrow keys, Home, End).
 */
export function Showcase({ dict, locale }: { dict: HomeDictionary; locale: Locale }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (index: number) => {
    const next = (index + FEATURES.length) % FEATURES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section aria-labelledby="showcase-title" id="platform" className="border-t border-line">
      <div className="container-site py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="showcase-title" className="text-4xl leading-[1.05] md:text-5xl lg:text-[3.5rem]">
            {dict.showcase.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">{dict.showcase.body}</p>
        </div>

        <div className="mt-10 flex justify-center">
          <div role="tablist" aria-labelledby="showcase-title" className="tabs">
            {FEATURES.map((_, index) => (
              <button
                key={index}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`showcase-tab-${index}`}
                aria-selected={active === index}
                aria-controls={`showcase-panel-${index}`}
                tabIndex={active === index ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
                  if (event.key === "ArrowRight") choose(active + (rtl ? -1 : 1));
                  else if (event.key === "ArrowLeft") choose(active + (rtl ? 1 : -1));
                  else if (event.key === "Home") choose(0);
                  else if (event.key === "End") choose(FEATURES.length - 1);
                  else return;
                  event.preventDefault();
                }}
                className="tab"
              >
                {dict.features[index]!.label}
              </button>
            ))}
          </div>
        </div>

        {FEATURES.map((feature, index) => {
          const text = dict.features[index]!;
          return (
            <div
              key={index}
              role="tabpanel"
              id={`showcase-panel-${index}`}
              aria-labelledby={`showcase-tab-${index}`}
              hidden={active !== index}
              className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface"
            >
              <div className="grid items-center gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12">
                <div className="lg:col-span-4">
                  <h3 className="text-2xl leading-tight md:text-3xl">{text.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted">{text.body}</p>
                  {feature.path && (
                    <Link
                      href={`/${locale}/${feature.path}`}
                      className="button button-secondary mt-8"
                    >
                      {dict.platform.learnMore}
                      <span className="sr-only">: {text.title}</span>
                      <ArrowRight className="arrow" aria-hidden />
                    </Link>
                  )}
                </div>
                <div className="lg:col-span-8">
                  {"desktop" in feature.shot ? (
                    <DesktopShot name={feature.shot.desktop} locale={locale} alt={dict.shots[feature.shot.desktop]} />
                  ) : (
                    <div className="flex items-start justify-center gap-6 sm:gap-10">
                      {feature.shot.phones.map((name, i) => (
                        <PhoneShot
                          key={name}
                          name={name}
                          locale={locale}
                          alt={dict.shots[name]}
                          className={`w-[44%] max-w-[250px] ${i === 1 ? "mt-12" : ""}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
