"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// The hero's scroll scene. The small tile under the announcement grows as the
// page scrolls, the text fades away, the tile fills the screen with light
// through leaves moving in the wind, and the platform rises into it at the
// end. The section is three screens tall; the stage stays pinned while it
// passes. Without JavaScript, or with reduced motion, the text and a still
// frame with the platform simply sit one under the other.

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The light through the leaves: drawn small, the browser enlarges it softly. */
const W = 160;
const H = 100;
const SHADOW = "#9a9b97";
const LIGHT = "#e8e6e1";

type Blob = { x: number; y: number; r: number; stretch: number; tilt: number; ax: number; ay: number; f: number; phase: number };

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scene() {
  const rnd = random(20261103);
  // Clumps of small leaves: many overlapping ellipses make ragged patches.
  const cluster = (count: number, leaves: [number, number], spread: [number, number], minR: number, maxR: number): Blob[] => {
    const blobs: Blob[] = [];
    for (let c = 0; c < count; c++) {
      const cx = rnd() * (W + 20) - 10;
      const cy = rnd() * (H + 20) - 10;
      const amp = 0.8 + rnd() * 2.2;
      const f = 0.22 + rnd() * 0.3;
      const phase = rnd() * Math.PI * 2;
      const size = leaves[0] + Math.floor(rnd() * (leaves[1] - leaves[0]));
      for (let i = 0; i < size; i++) {
        // Denser in the middle of a clump, sparse at its edge.
        const angle = rnd() * Math.PI * 2;
        const dist = Math.sqrt(rnd());
        blobs.push({
          x: cx + Math.cos(angle) * dist * spread[0],
          y: cy + Math.sin(angle) * dist * spread[1],
          r: minR + rnd() * (maxR - minR),
          stretch: 0.45 + rnd() * 0.5,
          tilt: rnd() * Math.PI,
          ax: amp * (0.7 + rnd() * 0.6),
          ay: amp * 0.55 * (0.7 + rnd() * 0.6),
          f: f * (0.85 + rnd() * 0.3),
          phase: phase + rnd() * 0.9,
        });
      }
    }
    return blobs;
  };
  return {
    glow: cluster(5, [1, 3], [10, 8], 9, 16),
    light: cluster(20, [8, 16], [16, 12], 1.6, 4.6),
    leaves: cluster(12, [6, 12], [10, 9], 1.4, 3.6),
  };
}

function draw(ctx: CanvasRenderingContext2D, blobs: ReturnType<typeof scene>, t: number) {
  const wind = Math.sin(t * 0.17) * 2 + Math.sin(t * 0.41) * 0.8;
  ctx.filter = "none";
  ctx.fillStyle = SHADOW;
  ctx.fillRect(0, 0, W, H);
  ctx.filter = "blur(3px)";
  ctx.fillStyle = LIGHT;
  const paint = (list: Blob[]) => {
    for (const b of list) {
      ctx.beginPath();
      ctx.ellipse(
        b.x + Math.sin(t * b.f + b.phase) * b.ax + wind,
        b.y + Math.cos(t * b.f * 0.8 + b.phase) * b.ay,
        b.r,
        b.r * b.stretch,
        b.tilt + Math.sin(t * b.f + b.phase) * 0.25,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  };
  // Broad soft light first, then a long streak past a trunk, then the leaf gaps.
  ctx.globalAlpha = 0.45;
  paint(blobs.glow);
  ctx.globalAlpha = 1;
  const sway = Math.sin(t * 0.2) * 1.2 + wind * 0.3;
  ctx.beginPath();
  ctx.moveTo(W * 0.36 + sway, -6);
  ctx.bezierCurveTo(W * 0.42 + sway, H * 0.3, W * 0.4, H * 0.6, W * 0.47, H + 6);
  ctx.lineTo(W * 0.56, H + 6);
  ctx.bezierCurveTo(W * 0.5, H * 0.6, W * 0.52 + sway, H * 0.3, W * 0.47 + sway, -6);
  ctx.closePath();
  ctx.fill();
  paint(blobs.light);
  // Leaves in front of the light.
  ctx.fillStyle = SHADOW;
  paint(blobs.leaves);
}

export function HeroScroll({
  top,
  bottom,
  desktop,
  phone,
}: {
  /** The announcement above the tile. */
  top: React.ReactNode;
  /** The heading and the buttons under the tile. */
  bottom: React.ReactNode;
  /** The platform on a computer and on a phone, shown inside the grown tile. */
  desktop: React.ReactNode;
  phone: React.ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const shot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  // The scroll scene only with motion allowed; set before the first paint.
  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setLive(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // The moving light (one still picture with reduced motion), only while in view.
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const blobs = scene();
    const start = performance.now();
    draw(ctx, blobs, 0);
    if (!live) return;
    let raf = 0;
    let last = 0;
    let visible = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return;
      last = now;
      draw(ctx, blobs, (now - start) / 1000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [live]);

  // The scene follows the scroll position.
  useEffect(() => {
    const el = { section: section.current, stage: stage.current, intro: intro.current, slot: slot.current, frame: frame.current, shot: shot.current };
    if (!live || !el.section || !el.stage || !el.intro || !el.slot || !el.frame || !el.shot) return;
    const { section: s, stage: st, intro: i, slot: sl, frame: f, shot: sh } = el as { [K in keyof typeof el]: NonNullable<(typeof el)[K]> };
    let raf = 0;

    const update = () => {
      raf = 0;
      const vw = st.clientWidth;
      const vh = st.clientHeight;
      const distance = s.offsetHeight - vh;
      const p = distance > 0 ? clamp(-s.getBoundingClientRect().top / distance) : 0;

      // The text leaves first.
      const fade = clamp(p / 0.16);
      i.style.opacity = String(1 - fade);
      i.style.transform = `translate3d(0, ${-fade * 48}px, 0)`;
      i.style.visibility = fade >= 1 ? "hidden" : "visible";

      // The tile grows from its place to the whole stage.
      const phone = vw < 768;
      const gutter = phone ? 12 : 32;
      const topEdge = phone ? 76 : 92;
      const toW = Math.min(vw - gutter * 2, 1500);
      const toH = vh - topEdge - gutter;
      const from = { x: i.offsetLeft + sl.offsetLeft, y: i.offsetTop + sl.offsetTop, w: sl.offsetWidth, h: sl.offsetHeight };
      const to = { x: (vw - toW) / 2, y: topEdge, w: toW, h: toH };
      const g = ease(clamp((p - 0.03) / 0.52));
      f.style.left = `${lerp(from.x, to.x, g)}px`;
      f.style.top = `${lerp(from.y, to.y, g)}px`;
      f.style.width = `${lerp(from.w, to.w, g)}px`;
      f.style.height = `${lerp(from.h, to.h, g)}px`;
      f.style.borderRadius = `${lerp(0, 8, g)}px`;
      f.style.opacity = "1";

      // The platform rises into it.
      const r = easeOut(clamp((p - 0.6) / 0.3));
      sh.style.opacity = String(r);
      sh.style.transform = `translate3d(0, ${(1 - r) * 80}px, 0)`;
      sh.style.visibility = r <= 0 ? "hidden" : "visible";
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      cancelAnimationFrame(raf);
      for (const node of [i, f, sh]) node.removeAttribute("style");
    };
  }, [live]);

  return (
    <section ref={section} id="hero" className={`hero-scroll${live ? " is-live" : ""}`}>
      <div ref={stage} className="hero-stage">
        <div ref={intro} className="hero-intro container-site">
          {top}
          <div ref={slot} aria-hidden className="hero-slot rise rise-delay-1" />
          {bottom}
        </div>
        <div ref={frame} className="hero-frame">
          <canvas ref={canvas} width={W} height={H} aria-hidden className="hero-light" />
          <div aria-hidden className="hero-grain" />
          <div ref={shot} className="hero-shot">
            <div className="hero-shot-desktop">{desktop}</div>
            <div className="hero-shot-phone">{phone}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
