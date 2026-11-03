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

/** Margin around the sketch, so the blur has no dark rim at the edges. */
const M = 8;

type Painter = (t: number) => void;

/**
 * The light, drawn without any filter into a sketch (every group of shapes is
 * one path and one fill), then copied to the visible canvas through a single
 * blur. Blurring each shape on its own cost a whole frame on a laptop.
 */
function painter(ctx: CanvasRenderingContext2D): Painter {
  const blobs = scene();
  const sketch = document.createElement("canvas");
  sketch.width = W + M * 2;
  sketch.height = H + M * 2;
  const s = sketch.getContext("2d")!;
  // Browsers without the canvas filter (older Safari) blur by drawing small and enlarging.
  ctx.filter = "blur(2px)";
  const filter = ctx.filter === "blur(2px)";
  ctx.filter = "none";
  const small = document.createElement("canvas");
  small.width = Math.round(W / 5);
  small.height = Math.round(H / 5);
  const sm = small.getContext("2d")!;

  const ellipses = (list: Blob[], t: number, wind: number) => {
    s.beginPath();
    for (const b of list) {
      const x = M + b.x + Math.sin(t * b.f + b.phase) * b.ax + wind;
      const y = M + b.y + Math.cos(t * b.f * 0.8 + b.phase) * b.ay;
      const tilt = b.tilt + Math.sin(t * b.f + b.phase) * 0.25;
      s.moveTo(x + Math.cos(tilt) * b.r, y + Math.sin(tilt) * b.r);
      s.ellipse(x, y, b.r, b.r * b.stretch, tilt, 0, Math.PI * 2);
    }
    s.fill();
  };

  return (t) => {
    const wind = Math.sin(t * 0.17) * 2 + Math.sin(t * 0.41) * 0.8;
    s.globalAlpha = 1;
    s.fillStyle = SHADOW;
    s.fillRect(0, 0, sketch.width, sketch.height);
    s.fillStyle = LIGHT;
    // Broad soft light first, then a long streak past a trunk, then the gaps between leaves.
    s.globalAlpha = 0.45;
    ellipses(blobs.glow, t, wind);
    s.globalAlpha = 1;
    const sway = Math.sin(t * 0.2) * 1.2 + wind * 0.3;
    s.beginPath();
    s.moveTo(M + W * 0.36 + sway, 0);
    s.bezierCurveTo(M + W * 0.42 + sway, M + H * 0.3, M + W * 0.4, M + H * 0.6, M + W * 0.47, H + M * 2);
    s.lineTo(M + W * 0.56, H + M * 2);
    s.bezierCurveTo(M + W * 0.5, M + H * 0.6, M + W * 0.52 + sway, M + H * 0.3, M + W * 0.47 + sway, 0);
    s.closePath();
    s.fill();
    ellipses(blobs.light, t, wind);
    // Leaves in front of the light.
    s.fillStyle = SHADOW;
    ellipses(blobs.leaves, t, wind);

    if (filter) {
      ctx.filter = "blur(2px)";
      ctx.drawImage(sketch, -M, -M);
      ctx.filter = "none";
    } else {
      sm.drawImage(sketch, M, M, W, H, 0, 0, small.width, small.height);
      ctx.drawImage(small, 0, 0, W, H);
    }
  };
}

/** Film grain: a small tile of random light and dark specks, made once. */
function grainTile(): string {
  const size = 128;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const g = tile.getContext("2d")!;
  const image = g.createImageData(size, size);
  const rnd = random(7);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = rnd() < 0.5 ? 0 : 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = Math.round(rnd() * 30);
  }
  g.putImageData(image, 0, 0);
  return `url(${tile.toDataURL("image/png")})`;
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

  // The moving light and the grain (one still picture with reduced motion),
  // only while the hero is on screen.
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    const root = section.current;
    if (!element || !ctx || !root) return;
    frame.current?.style.setProperty("--grain", grainTile());
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
      root.classList.toggle("is-playing", visible);
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      root.classList.remove("is-playing");
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
            <canvas ref={canvas} width={W} height={H} aria-hidden className="hero-light" />
            <div aria-hidden className="hero-grain" />
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
