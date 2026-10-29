import { ArrowRight } from "lucide-react";
import { TextLogo } from "@/components/ui/text-logo";
import { SITE } from "@/config/site";
import type { HomeDictionary } from "@/i18n/dictionary";

/** AI assistants the coming MCP connection is meant for (names only, no logos). */
const ASSISTANTS = ["ChatGPT", "Claude", "Gemini"];

/** An arrowhead on a ring of radius r at an angle, pointing along the ring. */
function Arrow({ r, angle, tone }: { r: number; angle: number; tone: "signal" | "muted" }) {
  return (
    <path
      d="M-5 -7 L7 0 L-5 7 L-2 0 Z"
      transform={`rotate(${angle} 300 300) translate(${300 + r} 300) rotate(90)`}
      fill={tone === "signal" ? "var(--signal)" : "currentColor"}
      opacity={tone === "signal" ? 1 : 0.45}
    />
  );
}

/** Rings with arrows that turn slowly (still for reduced motion, globals.css). */
function Orbits() {
  return (
    <g className="text-muted">
      <g className="orbit">
        <circle cx="300" cy="300" r="270" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 7" />
        <Arrow r={270} angle={-62} tone="signal" />
        <Arrow r={270} angle={18} tone="signal" />
        <Arrow r={270} angle={104} tone="muted" />
        <Arrow r={270} angle={196} tone="signal" />
      </g>
      <circle cx="300" cy="300" r="218" fill="none" stroke="currentColor" strokeOpacity="0.22" />
      <g className="orbit orbit-reverse">
        <circle cx="300" cy="300" r="166" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="5 8" />
        <Arrow r={166} angle={-140} tone="muted" />
        <Arrow r={166} angle={-20} tone="signal" />
        <Arrow r={166} angle={150} tone="muted" />
      </g>
    </g>
  );
}

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
