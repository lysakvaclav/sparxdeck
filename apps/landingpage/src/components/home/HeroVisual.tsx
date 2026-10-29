// The hero's drawing: a fire extinguisher with its QR label over the faint
// plan of a building, inside slow orbits with arrowheads (the rounds of
// inspections). Vector, in the theme's colours; the orbits stand still for
// reduced motion (globals.css).

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

/** Rings with arrows that turn slowly; shared by the hero and the MCP section. */
export function Orbits({ arrows = true }: { arrows?: boolean }) {
  return (
    <g className="text-muted">
      <g className="orbit">
        <circle cx="300" cy="300" r="270" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 7" />
        {arrows && (
          <>
            <Arrow r={270} angle={-62} tone="signal" />
            <Arrow r={270} angle={18} tone="signal" />
            <Arrow r={270} angle={104} tone="muted" />
            <Arrow r={270} angle={196} tone="signal" />
          </>
        )}
      </g>
      <circle cx="300" cy="300" r="218" fill="none" stroke="currentColor" strokeOpacity="0.22" />
      <g className="orbit orbit-reverse">
        <circle cx="300" cy="300" r="166" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="5 8" />
        {arrows && (
          <>
            <Arrow r={166} angle={-140} tone="muted" />
            <Arrow r={166} angle={-20} tone="signal" />
            <Arrow r={166} angle={150} tone="muted" />
          </>
        )}
      </g>
    </g>
  );
}

/** The plan of a building's floor, faint behind the extinguisher. */
function FloorPlan() {
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.2 } as const;
  return (
    <g className="text-muted" opacity="0.32" mask="url(#hv-fade)">
      <rect x="92" y="150" width="416" height="300" rx="10" {...line} />
      <path {...line} d="M92 300 H210 M250 300 H360 M400 300 H508 M230 150 V250 M230 340 V450 M380 150 V230 M380 360 V450" />
      {/* Doors */}
      <path {...line} strokeDasharray="2 3" d="M210 300 A40 40 0 0 1 250 260 M360 300 A40 40 0 0 0 400 260 M230 250 A40 40 0 0 0 270 290" />
      {/* Devices on the plan */}
      {[
        [130, 190],
        [470, 200],
        [150, 410],
        [455, 415],
        [300, 175],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="5" fill="var(--signal)" opacity="0.9" />
          <circle cx={x} cy={y} r="11" fill="none" stroke="var(--signal)" strokeOpacity="0.4" />
        </g>
      ))}
    </g>
  );
}

/** A small QR-like pattern for the label (fixed, decorative). */
const QR = [
  "1110111",
  "1010101",
  "1110111",
  "0001000",
  "1101011",
  "0100110",
  "1011101",
];

function Extinguisher() {
  return (
    <g>
      <defs>
        <linearGradient id="hv-body" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--signal)" stopOpacity="0.7" />
          <stop offset="0.35" stopColor="var(--signal)" />
          <stop offset="1" stopColor="var(--signal-deep)" />
        </linearGradient>
        <linearGradient id="hv-metal" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--metal-light)" />
          <stop offset="1" stopColor="var(--metal-dark)" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="300" cy="476" rx="66" ry="9" fill="currentColor" opacity="0.18" className="text-strong" />
      {/* Hose behind the body */}
      <path d="M322 214 C392 222 400 300 372 372 C362 398 358 418 360 440" fill="none" stroke="var(--metal-dark)" strokeWidth="9" strokeLinecap="round" />
      <path d="M352 436 L368 436 L372 470 L348 470 Z" fill="url(#hv-metal)" />
      {/* Body */}
      <path d="M252 276 Q252 236 300 236 Q348 236 348 276 V458 Q348 474 332 474 H268 Q252 474 252 458 Z" fill="url(#hv-body)" />
      <path d="M262 280 Q262 250 286 244" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" />
      {/* Label with a QR code */}
      <rect x="268" y="306" width="64" height="98" rx="5" fill="#fff" />
      <g transform="translate(279 316)">
        {QR.flatMap((row, y) =>
          [...row].map((cell, x) => (cell === "1" ? <rect key={`${x}-${y}`} x={x * 6} y={y * 6} width="6" height="6" fill="#0b0d10" /> : null)),
        )}
      </g>
      <rect x="276" y="368" width="48" height="4" rx="2" fill="#0b0d10" opacity="0.7" />
      <rect x="276" y="378" width="34" height="4" rx="2" fill="#0b0d10" opacity="0.35" />
      <rect x="276" y="388" width="40" height="4" rx="2" fill="#0b0d10" opacity="0.35" />
      {/* Neck, valve and handle */}
      <rect x="287" y="214" width="26" height="24" rx="3" fill="url(#hv-metal)" />
      <rect x="276" y="198" width="48" height="18" rx="4" fill="url(#hv-metal)" />
      <path d="M296 198 L360 180" stroke="var(--metal-dark)" strokeWidth="8" strokeLinecap="round" />
      <path d="M300 214 L352 214" stroke="var(--metal-light)" strokeWidth="7" strokeLinecap="round" />
      {/* Gauge */}
      <circle cx="268" cy="206" r="13" fill="#fff" stroke="var(--metal-dark)" strokeWidth="3" />
      <path d="M262 210 A8 8 0 0 1 274 210" fill="none" stroke="#16a34a" strokeWidth="2.5" />
      <path d="M268 206 L273 200" stroke="#0b0d10" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/** Decorative: the page's text says what it shows. */
export function HeroVisual() {
  return (
    <svg viewBox="0 0 600 600" aria-hidden className="h-full w-full overflow-visible">
      <defs>
        {/* The plan fades out towards its edges. */}
        <radialGradient id="hv-fade-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="hv-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="600">
          <rect width="600" height="600" fill="url(#hv-fade-gradient)" />
        </mask>
        <radialGradient id="hv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--text-strong)" stopOpacity="0.07" />
          <stop offset="1" stopColor="var(--text-strong)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="300" r="240" fill="url(#hv-glow)" />
      <FloorPlan />
      <Orbits />
      <Extinguisher />
    </svg>
  );
}
