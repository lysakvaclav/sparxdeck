import { ArrowRight } from "lucide-react";
import { BsOpenai } from "react-icons/bs";
import { SiClaude } from "react-icons/si";
import { TextLogo } from "@/components/ui/text-logo";
import { SITE } from "@/config/site";
import type { HomeDictionary } from "@/i18n/dictionary";

/** Gemini's spark in its own gradient (the icon set has it only in one colour). */
function GeminiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="mcp-gemini" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.55" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill="url(#mcp-gemini)"
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  );
}

/** The assistants around SparxDeck, each on the middle ring (angle in degrees, 0 = right). */
const ASSISTANTS = [
  { name: "ChatGPT", angle: -90, logo: <BsOpenai className="h-7 w-7 text-strong" aria-hidden /> },
  { name: "Claude", angle: 30, logo: <SiClaude className="h-7 w-7 text-[#D97757]" aria-hidden /> },
  { name: "Gemini", angle: 150, logo: <GeminiLogo className="h-7 w-7" /> },
];

const RING = 218;

/** Where an angle on the middle ring lies, in the 600 × 600 drawing. */
function onRing(angle: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [300 + RING * Math.cos(radians), 300 + RING * Math.sin(radians)];
}

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

/** Rings that turn slowly, and the lines data travels along (still for reduced motion, globals.css). */
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
      <circle cx="300" cy="300" r={RING} fill="none" stroke="currentColor" strokeOpacity="0.22" />
      <g className="orbit orbit-reverse">
        <circle cx="300" cy="300" r="140" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="5 8" />
        <Arrow r={140} angle={-140} tone="muted" />
        <Arrow r={140} angle={-20} tone="signal" />
        <Arrow r={140} angle={150} tone="muted" />
      </g>
      {ASSISTANTS.map(({ name, angle }) => {
        const [x, y] = onRing(angle);
        return (
          <line
            key={name}
            x1="300"
            y1="300"
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeDasharray="3 6"
            className="flow"
          />
        );
      })}
    </g>
  );
}

/** SparxDeck's data in AI assistants over MCP. */
export function Mcp({ dict }: { dict: HomeDictionary }) {
  const m = dict.mcp;
  return (
    <section aria-labelledby="mcp-title" id="mcp" className="border-t border-line">
      <div className="container-site grid items-center gap-16 py-24 md:py-32 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 id="mcp-title" className="text-4xl leading-[1.05] md:text-5xl lg:text-[3.5rem]">
            {m.title} <span className="text-muted">{m.titleRest}</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">{m.body}</p>

          {/* An example: a question to the assistant and the answer from SparxDeck. */}
          <div className="mt-10 max-w-xl space-y-4 rounded-2xl border border-line p-5">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-surface px-4 py-2.5 text-sm text-strong">
              {m.question}
            </p>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line">
                <TextLogo className="aspect-square h-3.5 text-strong" />
              </span>
              <p className="text-sm leading-relaxed text-main">{m.answer}</p>
            </div>
          </div>

          <a href={SITE.bookingUrl} className="button button-primary mt-10">
            {m.cta}
            <ArrowRight className="arrow" aria-hidden />
          </a>
        </div>

        {/* The drawing is the same in both directions (positions are physical). */}
        <div className="relative mx-auto aspect-square w-full max-w-[34rem]" dir="ltr">
          <svg viewBox="0 0 600 600" aria-hidden className="absolute inset-0 h-full w-full">
            <Orbits />
          </svg>
          <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-line-strong bg-background shadow-[var(--shot-shadow)] md:size-24">
            <TextLogo label="SparxDeck" className="aspect-square h-9 text-strong md:h-11" />
          </div>
          <ul aria-label="ChatGPT, Claude, Gemini">
            {ASSISTANTS.map(({ name, angle, logo }) => {
              const [x, y] = onRing(angle);
              return (
                <li
                  key={name}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(x / 600) * 100}%`, top: `${(y / 600) * 100}%` }}
                >
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-line bg-background shadow-[var(--shot-shadow)] md:size-16">
                    {logo}
                  </span>
                  <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-muted">
                    {name}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
