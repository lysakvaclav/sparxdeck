"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { ComparisonDictionary } from "@/i18n/dictionary";

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      strokeWidth="1"
      stroke="currentColor"
      className={`size-6 text-[var(--color-text-strong)] ${className}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  );
}

function CornerPlusIcons() {
  return (
    <>
      <PlusIcon className="absolute -top-3 -left-3" />
      <PlusIcon className="absolute -top-3 -right-3" />
      <PlusIcon className="absolute -bottom-3 -left-3" />
      <PlusIcon className="absolute -bottom-3 -right-3" />
    </>
  );
}

function OldMark() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]"
    >
      <X className="size-3" strokeWidth={2} />
    </span>
  );
}

function NewMark() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-foreground)] text-[var(--color-primary)]"
    >
      <Check className="size-3" strokeWidth={2.5} />
    </span>
  );
}

// Hairline that stays visible on the inverted SparxDeck column in both themes.
const INVERTED_RULE = "border-[color-mix(in_srgb,var(--color-primary-foreground)_14%,transparent)]";

export function ComparisonSection({ dict }: { dict: ComparisonDictionary }) {
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <section
      id="comparison"
      aria-labelledby="comparison-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 md:px-8 lg:px-12"
    >
      <div className="py-12 sm:py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2
            id="comparison-heading"
            className="display-font text-2xl text-[var(--color-text-strong)] sm:text-3xl lg:text-4xl"
          >
            {dict.title}
          </h2>
          <p className="max-w-xl text-sm text-[var(--color-text-muted)] sm:text-base">{dict.subtitle}</p>
        </div>

        <motion.div
          {...reveal}
          className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2 sm:p-3"
        >
          <CornerPlusIcons />

          {/* Desktop: one aligned table, the SparxDeck column inverted. */}
          <div
            role="table"
            aria-labelledby="comparison-heading"
            className="relative hidden grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] md:grid"
          >
            <div
              aria-hidden
              className="col-start-3 row-start-1 rounded-md bg-[var(--color-primary)] shadow-sm"
              style={{ gridRowEnd: `span ${dict.rows.length + 1}` }}
            />

            <div role="row" className="contents">
              <div role="columnheader" className="col-start-1 row-start-1 px-5 py-5" />
              <div
                role="columnheader"
                className="col-start-2 row-start-1 flex items-center gap-2 px-6 py-5 text-sm font-medium text-[var(--color-text-muted)]"
              >
                <span className="size-1.5 rounded-full bg-[var(--color-text-muted)]" aria-hidden />
                {dict.oldLabel}
              </div>
              <div
                role="columnheader"
                className="relative col-start-3 row-start-1 flex items-center gap-2 px-6 py-5 text-sm font-semibold text-[var(--color-primary-foreground)]"
              >
                <span className="size-1.5 rounded-full bg-[var(--color-primary-foreground)]" aria-hidden />
                {dict.newLabel}
              </div>
            </div>

            {dict.rows.map((row, index) => {
              const gridRow = index + 2;
              return (
                <div role="row" className="contents" key={row.topic}>
                  <div
                    role="rowheader"
                    className="col-start-1 border-t border-[var(--color-border)] px-5 py-5 text-sm font-semibold text-[var(--color-text-strong)]"
                    style={{ gridRow }}
                  >
                    {row.topic}
                  </div>
                  <div
                    role="cell"
                    className="col-start-2 flex gap-3 border-t border-[var(--color-border)] px-6 py-5 text-sm text-[var(--color-text-muted)]"
                    style={{ gridRow }}
                  >
                    <OldMark />
                    <span>{row.old}</span>
                  </div>
                  <div
                    role="cell"
                    className={`relative col-start-3 flex gap-3 border-t px-6 py-5 text-sm text-[var(--color-primary-foreground)] ${INVERTED_RULE}`}
                    style={{ gridRow }}
                  >
                    <NewMark />
                    <span>{row.new}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: one card per step, before and after stacked. */}
          <ul className="space-y-2 md:hidden">
            {dict.rows.map((row) => (
              <li
                key={row.topic}
                className="rounded-md border border-[var(--color-border)] bg-[var(--background)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">{row.topic}</p>
                <div className="mt-3 flex gap-3 text-sm text-[var(--color-text-muted)]">
                  <OldMark />
                  <p>
                    <span className="sr-only">{dict.oldLabel}: </span>
                    {row.old}
                  </p>
                </div>
                <div className="mt-2 flex gap-3 rounded-md bg-[var(--color-primary)] p-3 text-sm text-[var(--color-primary-foreground)]">
                  <NewMark />
                  <p>
                    <span className="sr-only">{dict.newLabel}: </span>
                    {row.new}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
