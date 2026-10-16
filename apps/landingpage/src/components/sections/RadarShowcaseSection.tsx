"use client";

import React, { useEffect, useRef, useState } from "react";
import { Component as RadarChart } from "@/components/ui/radar-chart";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import type { RadarDictionary } from "@/i18n/dictionary";

const values = [88, 82, 90, 86, 84, 92];

export function RadarShowcaseSection({ dict }: { dict: RadarDictionary }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = Math.min(el.clientWidth, 360);
      const h = w;
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      aria-labelledby="radar-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 md:px-8 lg:px-12"
    >
      <div className="py-12 sm:py-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2
            id="radar-heading"
            className="display-font text-2xl sm:text-3xl lg:text-4xl text-[var(--color-text-strong)]"
          >
            {dict.title}
          </h2>
          <p className="max-w-xl text-sm sm:text-base text-[var(--color-text-muted)]">{dict.subtitle}</p>
        </div>
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] md:items-start">
          <div ref={chartRef} className="w-full">
            {size.w > 0 && (
              <div className="mx-auto w-full max-w-[360px]">
                <RadarChart
                  width={size.w}
                  height={size.h}
                  data={values}
                  getValue={(d) => Number(d)}
                  levels={5}
                  margin={{ top: 32, right: 32, bottom: 32, left: 32 }}
                  labels={dict.labels}
                />
              </div>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute left-0 top-0 w-full">
              <ScrollProgress
                containerRef={textRef as React.RefObject<HTMLDivElement>}
                className="absolute top-0 h-0.5 bg-[linear-gradient(to_right,rgba(0,0,0,0),var(--color-text-strong)_70%,var(--color-text-strong)_100%)]"
              />
            </div>
            <div
              ref={textRef}
              className="mt-4 max-h-[340px] space-y-6 overflow-y-auto pr-2 pt-4 text-sm text-[var(--color-text-main)] sm:text-[15px]"
            >
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-[15px]">
                  {dict.keyAreasHeading}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {dict.keyAreas.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-[var(--color-text-strong)]">
                        {item.title}
                      </div>
                      <div className="text-[var(--color-text-main)]">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-[15px]">
                  {dict.howItWorksHeading}
                </h3>
                <ul className="space-y-2 pl-4">
                  {dict.howItWorks.map((text) => (
                    <li key={text} className="list-disc">
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-[15px]">
                  {dict.resultHeading}
                </h3>
                <ul className="space-y-2 pl-4">
                  {dict.result.map((text) => (
                    <li key={text} className="list-disc">
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
