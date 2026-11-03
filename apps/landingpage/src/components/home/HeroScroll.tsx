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

/** The light through the leaves: a small scene the browser enlarges softly. */
const W = 160;
const H = 100;
const SHADOW = "#9a9b97";

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

/** Pixels per unit of the scene. */
const R = 2;
/** How far a shape's soft edge reaches beyond its solid core. */
const FEATHER = 2.4;

type Painter = (t: number) => void;

/** A colour fading to nothing from the middle of a unit circle outward. */
function softFill(ctx: CanvasRenderingContext2D, [r, g, b]: [number, number, number]) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  // A smooth bell, without a visible rim anywhere.
  for (const [at, alpha] of [[0, 1], [0.25, 0.94], [0.45, 0.72], [0.62, 0.42], [0.78, 0.17], [0.9, 0.05], [1, 0]] as const) {
    gradient.addColorStop(at, `rgb(${r} ${g} ${b} / ${alpha})`);
  }
  return gradient;
}

/**
 * The light: every leaf and gap is a soft-edged ellipse, so the picture needs
 * no blur filter (a large canvas blur is blocky in Chrome and cost a whole
 * frame when applied shape by shape). Smooth at any size and cheap to draw.
 */
function painter(ctx: CanvasRenderingContext2D): Painter {
  const blobs = scene();
  const light = softFill(ctx, [232, 230, 225]);
  const shadow = softFill(ctx, [154, 155, 151]);

  const blob = (x: number, y: number, rx: number, ry: number, tilt: number) => {
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    // Scale to pixels, move to the centre, turn, stretch the unit circle.
    ctx.setTransform(R * rx * FEATHER * cos, R * rx * FEATHER * sin, -R * ry * FEATHER * sin, R * ry * FEATHER * cos, R * x, R * y);
    ctx.fillRect(-1, -1, 2, 2);
  };

  const paintAll = (list: Blob[], t: number, wind: number) => {
    for (const b of list) {
      blob(
        b.x + Math.sin(t * b.f + b.phase) * b.ax + wind,
        b.y + Math.cos(t * b.f * 0.8 + b.phase) * b.ay,
        b.r,
        b.r * b.stretch,
        b.tilt + Math.sin(t * b.f + b.phase) * 0.25,
      );
    }
  };

  return (t) => {
    const wind = Math.sin(t * 0.17) * 2 + Math.sin(t * 0.41) * 0.8;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = SHADOW;
    ctx.fillRect(0, 0, W * R, H * R);
    ctx.fillStyle = light;
    // Broad soft light first.
    ctx.globalAlpha = 0.45;
    paintAll(blobs.glow, t, wind);
    ctx.globalAlpha = 1;
    // A long streak of light past a trunk: soft ellipses along a gentle curve.
    const sway = Math.sin(t * 0.2) * 1.2 + wind * 0.3;
    for (let i = 0; i <= 18; i++) {
      const k = i / 18;
      const x = W * (0.42 + 0.08 * k) + sway * (1 - k) + Math.sin(k * 3) * 2;
      blob(x, -4 + k * (H + 8), W * 0.05, 7, 0.08);
    }
    // The gaps between leaves, then leaves in front of the light.
    paintAll(blobs.light, t, wind);
    ctx.fillStyle = shadow;
    paintAll(blobs.leaves, t, wind);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
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
  const inner = useRef<HTMLDivElement>(null);
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

  // The moving light (one still picture with reduced motion),
  // only while the hero is on screen.
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    const root = section.current;
    if (!element || !ctx || !root) return;
    const paint = painter(ctx);
    const start = performance.now();
    paint(0);
    if (!live) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // 30 pictures a second are plenty for leaves in a breeze.
      if (now - last < 32) return;
      last = now;
      paint((now - start) / 1000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting);
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [live]);

  // The scene follows the scroll. Sizes are measured only when the window
  // changes; while scrolling only transform and opacity change, which the
  // browser composes without laying out or repainting anything.
  useEffect(() => {
    const [s, st, i, sl, f, inn, sh] = [section.current, stage.current, intro.current, slot.current, frame.current, inner.current, shot.current];
    if (!live || !s || !st || !i || !sl || !f || !inn || !sh) return;
    let raf = 0;
    let sectionTop = 0;
    let distance = 1;
    let from = { x: 0, y: 0, w: 1, h: 1 };
    let to = { x: 0, y: 0, w: 1, h: 1 };
    let lastP = -1;
    let introHidden = false;
    let shotHidden = false;

    const measure = () => {
      const vw = st.clientWidth;
      const vh = st.clientHeight;
      sectionTop = s.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, s.offsetHeight - vh);
      const phone = vw < 768;
      const gutter = phone ? 12 : 32;
      const topEdge = phone ? 76 : 92;
      const w = Math.min(vw - gutter * 2, 1500);
      to = { x: (vw - w) / 2, y: topEdge, w, h: vh - topEdge - gutter };
      from = { x: i.offsetLeft + sl.offsetLeft, y: i.offsetTop + sl.offsetTop, w: sl.offsetWidth, h: sl.offsetHeight };
      f.style.left = `${to.x}px`;
      f.style.top = `${to.y}px`;
      f.style.width = `${to.w}px`;
      f.style.height = `${to.h}px`;
      f.style.opacity = "1";
      lastP = -1;
    };

    const update = () => {
      raf = 0;
      const p = clamp((window.scrollY - sectionTop) / distance);
      if (p === lastP) return;
      lastP = p;

      // The text leaves first.
      const fade = clamp(p / 0.16);
      i.style.opacity = String(1 - fade);
      i.style.transform = `translate3d(0, ${(-fade * 48).toFixed(2)}px, 0)`;
      if (fade >= 1 !== introHidden) {
        introHidden = fade >= 1;
        i.style.visibility = introHidden ? "hidden" : "";
      }

      // The tile grows from its place to the whole stage. The frame is always
      // full size and scaled down, its content scaled back up, so the frame
      // works as a window that opens.
      const g = ease(clamp((p - 0.03) / 0.52));
      const w = lerp(from.w, to.w, g);
      const h = lerp(from.h, to.h, g);
      const sx = w / to.w;
      const sy = h / to.h;
      const dx = lerp(from.x, to.x, g) - to.x;
      const dy = lerp(from.y, to.y, g) - to.y;
      f.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
      inn.style.transform = `scale(${(1 / sx).toFixed(5)}, ${(1 / sy).toFixed(5)}) translate3d(${(-(to.w - w) / 2).toFixed(2)}px, ${(-(to.h - h) / 2).toFixed(2)}px, 0)`;

      // The platform rises into it.
      const r = easeOut(clamp((p - 0.6) / 0.3));
      sh.style.opacity = String(r);
      sh.style.transform = `translate3d(0, ${((1 - r) * 80).toFixed(2)}px, 0)`;
      if (r <= 0 !== shotHidden) {
        shotHidden = r <= 0;
        sh.style.visibility = shotHidden ? "hidden" : "";
      }
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const resize = () => {
      measure();
      request();
    };
    measure();
    update();
    const observer = new ResizeObserver(resize);
    observer.observe(st);
    observer.observe(i);
    window.addEventListener("scroll", request, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", request);
      cancelAnimationFrame(raf);
      for (const node of [i, f, inn, sh]) node.removeAttribute("style");
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
          <div ref={inner} className="hero-inner">
            <canvas ref={canvas} width={W * R} height={H * R} aria-hidden className="hero-light" />
            <div ref={shot} className="hero-shot">
              <div className="hero-shot-desktop">{desktop}</div>
              <div className="hero-shot-phone">{phone}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
