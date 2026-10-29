import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { SITE } from "@/config/site";
import type { HomeDictionary } from "@/i18n/dictionary";
import { SectionHeading } from "./Platform";

/** Paper and Excel against SparxDeck, step by step. */
export function Comparison({ dict }: { dict: HomeDictionary }) {
  const c = dict.comparison;
  return (
    <section aria-labelledby="comparison-title" className="border-t border-line">
      <div className="container-site py-24 md:py-32">
        <SectionHeading title={c.title} body={c.body} id="comparison-title" />
        {/* Scrolls sideways on narrow phones: reachable by keyboard too. */}
        <div tabIndex={0} role="region" aria-labelledby="comparison-title" className="mt-16 overflow-x-auto border border-line">
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
                      <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />
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
    <section aria-labelledby="faq-title" id="faq" className="border-t border-line">
      <div className="container-site grid gap-12 py-24 md:py-32 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="faq-title" className="text-4xl leading-[1.05] md:text-5xl">
            {f.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">{f.body}</p>
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
                <Plus className="faq-icon h-5 w-5 shrink-0 text-muted transition-transform duration-200" aria-hidden />
              </summary>
              <p className="max-w-3xl pb-6 text-base leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The closing statement, centred, as at the end of the reference. */
export function Cta({ dict }: { dict: HomeDictionary }) {
  const c = dict.cta;
  return (
    <section aria-labelledby="cta-title" className="border-t border-line">
      <div className="container-site flex flex-col items-center py-28 text-center md:py-40">
        <h2 id="cta-title" className="max-w-4xl text-4xl leading-[1.05] md:text-6xl">
          {c.title}
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">{c.body}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href={SITE.signupUrl} className="button button-primary">
            {c.primary}
            <ArrowRight className="arrow" aria-hidden />
          </a>
          <a href={SITE.bookingUrl} className="button button-secondary">
            {c.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
