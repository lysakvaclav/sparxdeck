import type { HomeDictionary } from "@/i18n/dictionary";

// Three principles, each with a line drawing (isometric, in the text colour).

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

/** A flat isometric plate whose top corner is at (x, y). */
function Plate({ x, y, w = 70, h = 35, depth = 8 }: { x: number; y: number; w?: number; h?: number; depth?: number }) {
  return (
    <g>
      <path {...line} d={`M${x} ${y} L${x + w} ${y + h} L${x} ${y + 2 * h} L${x - w} ${y + h} Z`} />
      <path
        {...line}
        d={`M${x - w} ${y + h} V${y + h + depth} L${x} ${y + 2 * h + depth} L${x + w} ${y + h + depth} V${y + h} M${x} ${y + 2 * h} V${y + 2 * h + depth}`}
      />
    </g>
  );
}

/** Simple: one plate on top of thin layers, a tick on it. */
function FigureSimple() {
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full" aria-hidden>
      <g opacity="0.35">
        <Plate x={120} y={78} />
      </g>
      <g opacity="0.6">
        <Plate x={120} y={58} />
      </g>
      <Plate x={120} y={38} />
      <path {...line} d="M100 73 L115 82 L142 62" strokeWidth={1.5} />
    </svg>
  );
}

/** Without a signal: a phone, and what waits in it rising once there's a connection. */
function FigureOffline() {
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full" aria-hidden>
      <Plate x={120} y={110} w={56} h={28} depth={10} />
      <path {...line} d="M104 138 L120 146 L136 138" opacity="0.6" />
      {[0, 1, 2].map((step) => (
        <g key={step} opacity={1 - step * 0.28}>
          <Plate x={120} y={78 - step * 30} w={18} h={9} depth={4} />
        </g>
      ))}
      <path {...line} d="M120 106 V26" strokeDasharray="2 4" opacity="0.5" />
    </svg>
  );
}

/** Your data: a closed box inside a larger one. */
function FigureData() {
  return (
    <svg viewBox="0 0 240 200" className="h-full w-full" aria-hidden>
      <g opacity="0.5">
        <path {...line} d="M120 20 L190 55 L190 135 L120 170 L50 135 L50 55 Z M50 55 L120 90 L190 55 M120 90 V170" />
      </g>
      <path {...line} d="M120 70 L150 85 L150 120 L120 135 L90 120 L90 85 Z M90 85 L120 100 L150 85 M120 100 V135" />
      <path {...line} d="M112 112 V104 A8 8 0 0 1 128 104 V112" opacity="0.8" />
    </svg>
  );
}

const FIGURES = [FigureSimple, FigureOffline, FigureData];

export function Principles({ dict }: { dict: HomeDictionary }) {
  const p = dict.principles;
  return (
    <section aria-label={p.title} className="border-t border-line">
      <ul className="container-site grid md:grid-cols-3">
        {p.items.map((item, index) => {
          const Figure = FIGURES[index] ?? FigureSimple;
          return (
            <li
              key={item.title}
              className="flex flex-col border-line py-14 md:py-20 md:ps-10 md:first:ps-0 md:[&:not(:first-child)]:border-s max-md:[&:not(:first-child)]:border-t"
            >
              <p className="fig">FIG 0.{index + 1}</p>
              <div className="mx-auto my-12 h-56 w-full max-w-[300px] text-muted">
                <Figure />
              </div>
              <h3 className="text-lg font-medium tracking-tight">{item.title}</h3>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-muted">{item.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
