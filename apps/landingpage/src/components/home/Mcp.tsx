import { ArrowRight } from "lucide-react";
import { Orbits } from "@/components/home/HeroVisual";
import { TextLogo } from "@/components/ui/text-logo";
import { SITE } from "@/config/site";
import type { HomeDictionary } from "@/i18n/dictionary";

/** AI assistants the coming MCP connection is meant for (names only, no logos). */
const ASSISTANTS = ["ChatGPT", "Claude", "Gemini"];

/** The coming MCP connection: SparxDeck's data in AI assistants. */
export function Mcp({ dict }: { dict: HomeDictionary }) {
  const m = dict.mcp;
  return (
    <section aria-labelledby="mcp-title" id="mcp" className="border-t border-line">
      <div className="container-site py-24 md:py-32">
        <div className="grid overflow-hidden rounded-3xl border border-line bg-surface lg:grid-cols-2">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden lg:aspect-auto lg:min-h-[34rem] border-line max-lg:border-b lg:border-e">
            <svg viewBox="0 0 600 600" aria-hidden className="absolute inset-0 h-full w-full">
              <Orbits />
            </svg>
            <div className="relative flex flex-col items-center gap-6 text-center">
              <TextLogo label="SparxDeck" className="h-9 text-strong md:h-11" />
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label={m.title}>
                {ASSISTANTS.map((name) => (
                  <li key={name} className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-muted md:text-2xl">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col justify-center p-8 md:p-14">
            <span className="self-start rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
              {m.badge}
            </span>
            <h2 id="mcp-title" className="mt-6 text-4xl leading-[1.05] md:text-5xl">
              {m.title} <span className="text-muted">{m.titleRest}</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted md:text-lg">{m.body}</p>
            <a href={SITE.bookingUrl} className="button button-secondary mt-10 self-start">
              {m.cta}
              <ArrowRight className="arrow" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
