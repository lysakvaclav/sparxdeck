"use client";

import { useState } from "react";
import Script from "next/script";
import type { FaqDictionary } from "@/i18n/dictionary";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};
function FaqRow({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-none border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 shadow-sm sm:px-6 sm:py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-base font-semibold text-[var(--color-text-strong)] sm:text-lg">
          {item.question}
        </span>
        <span className="text-xl leading-none text-[var(--color-text-strong)] sm:text-2xl">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      <div
        className={
          (isOpen ? "mt-2 grid grid-rows-[1fr]" : "grid grid-rows-[0fr]") +
          " transition-all duration-300 ease-in-out"
        }
      >
        <div className="overflow-hidden max-w-xl text-sm text-[var(--color-text-main)] sm:text-base">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

export function FaqSection({ dict }: { dict: FaqDictionary }) {
  const faqItems: FaqItem[] = dict.items;
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <section id="faq" className="scroll-mt-28 pt-10 sm:pt-12">
      {/* JSON-LD: FAQPage for rich results */}
      <Script id="ld-faq" type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        })}
      </Script>
      <div className="bg-[var(--background)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12 lg:py-16">
          <div className="mx-auto flex max-w-5xl flex-col gap-10 md:flex-row md:gap-16">
            <div className="md:w-1/3">
              <h2 className="display-font text-3xl leading-tight tracking-tight text-[var(--color-text-strong)] sm:text-4xl">
                {dict.headingLine1}
                {dict.headingLine2 && (
                  <>
                    <br />
                    {dict.headingLine2}
                  </>
                )}
              </h2>
            </div>
            <div className="md:w-2/3 space-y-4">
              {faqItems.map((item) => {
                const isOpen = item.id === openId;
                return (
                  <FaqRow
                    key={item.id}
                    item={item}
                    isOpen={isOpen}
                    onToggle={() => setOpenId(isOpen ? null : item.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
