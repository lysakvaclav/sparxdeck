import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { SITE } from "@/config/site";
import type { HomeDictionary } from "@/i18n/dictionary";
import { SectionHeading } from "./Platform";

/** Paper and Excel against SparxDeck, step by step. */
export function Comparison({ dict }: { dict: HomeDictionary }) {
  const c = dict.comparison;
  return (
    <section aria-labelledby="comparison-title" className="border-b border-line">
      <div className="container-site py-20 md:py-28">
        <SectionHeading eyebrow={c.eyebrow} title={c.title} body={c.body} id="comparison-title" />
        <div className="mt-14 overflow-hidden border border-line">
          <table className="w-full border-collapse text-start text-sm md:text-base">
            <thead>
              <tr className="bg-surface">
                <th scope="col" className="w-[24%] p-4 text-start font-medium text-muted md:p-5">
                  <span className="sr-only">{c.title}</span>
                </th>
                <th scope="col" className="w-[38%] border-s border-line p-4 text-start font-medium text-muted md:p-5">
                  {c.oldLabel}
                </th>
                <th scope="col" className="w-[38%] border-s border-line p-4 text-start font-medium text-strong md:p-5">
                  {c.newLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.topic} className="border-t border-line align-top">
                  <th scope="row" className="p-4 text-start font-medium text-strong md:p-5">
                    {row.topic}
                  </th>
                  <td className="border-s border-line p-4 text-muted md:p-5">
                    <span className="flex gap-2.5">
                      <Minus className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                      {row.old}
                    </span>
                  </td>
                  <td className="border-s border-line p-4 text-strong md:p-5">
                    <span className="flex gap-2.5">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      {row.new}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Questions on one side, the way to ask more on the other. Works without JavaScript. */
export function Faq({ dict, bookDemo }: { dict: HomeDictionary; bookDemo: string }) {
  const f = dict.faq;
  return (
    <section aria-labelledby="faq-title" id="faq" className="border-b border-line">
      <div className="container-site grid gap-12 py-20 md:py-28 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow">{f.eyebrow}</p>
          <h2 id="faq-title" className="mt-5 text-3xl leading-[1.08] md:text-5xl">
            {f.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-main">{f.body}</p>
          <a href={SITE.bookingUrl} className="button button-primary mt-8">
            {bookDemo}
            <ArrowRight className="arrow" aria-hidden />
          </a>
        </div>
        <div className="border-t border-line lg:col-span-8">
          {f.items.map((item) => (
            <details key={item.question} className="group border-b border-line">
              <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-5 text-base font-medium text-strong md:text-lg">
                {item.question}
                <Plus className="faq-icon h-5 w-5 shrink-0 text-accent transition-transform duration-200" aria-hidden />
              </summary>
              <p className="max-w-3xl pb-6 text-base leading-relaxed text-main">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The closing band: dark in both themes, the buttons in reverse. */
export function Cta({ dict }: { dict: HomeDictionary }) {
  const c = dict.cta;
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden bg-[#0b0d10] text-[#c7ccd2] [--grid-line:rgba(255,255,255,0.06)] dark:border-b dark:border-line dark:bg-[#111317]">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-0 opacity-80" />
      <div className="container-site relative grid gap-10 py-20 md:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h2 id="cta-title" className="text-3xl leading-[1.08] text-white md:text-5xl">
            {c.title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed md:text-lg">{c.body}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
          <a href={SITE.signupUrl} className="button bg-white text-[#0b0d10] hover:bg-[#e6e8eb]">
            {c.primary}
            <ArrowRight className="arrow" aria-hidden />
          </a>
          <a href={SITE.bookingUrl} className="button border-[#3a4049] text-white hover:bg-white/10">
            {c.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
