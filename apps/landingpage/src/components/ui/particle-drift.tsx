"use client";

import { useEffect, useRef } from "react";

/*
 * Particle Drift: characters drifting down, joined by faint lines when close,
 * fast light beams rising, and links to the pointer. Inspired by the 21st.dev
 * "Particle Drift" effect, rewritten as a plain 2D canvas: no iframe, no CDN
 * scripts, monochrome to match the site.
 *
 * Performance: the beam gradient is pre-rendered once and blitted; neighbour
 * lines are batched into a few paths by opacity; device pixel ratio is capped;
 * particle counts scale with the area; motion is time-based; the loop sleeps
 * while off-screen or in a background tab; reduced motion draws a single frame.
 */

type Palette = { beam: string; node: string; link: string; hot: string };

const PALETTES: Record<"light" | "dark", Palette> = {
  light: { beam: "17,17,17", node: "82,82,82", link: "64,64,64", hot: "17,17,17" },
  dark: { beam: "255,255,255", node: "163,163,163", link: "180,180,180", hot: "255,255,255" },
};

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=".split("");
const LINK_DISTANCE = 120;
const POINTER_DISTANCE = 180;
const LINK_BUCKETS = 4;
const MAX_DPR = 1.5;

type Node = { x: number; y: number; vy: number; char: string };
type Beam = { x: number; y: number; length: number; speed: number; opacity: number };

const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)] ?? "0";

/** A white-to-transparent vertical strip, tinted per palette and reused for every beam. */
function makeBeamSprite(rgb: string) {
  const sprite = document.createElement("canvas");
  sprite.width = 2;
  sprite.height = 128;
  const ctx = sprite.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 128);
  }
  return sprite;
}

export function ParticleDrift({ dark, className }: { dark: boolean; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkRef = useRef(dark);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    darkRef.current = dark;
    redrawRef.current?.();
  }, [dark]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = { light: makeBeamSprite(PALETTES.light.beam), dark: makeBeamSprite(PALETTES.dark.beam) };
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let beams: Beam[] = [];
    const pointer = { x: -9999, y: -9999, inside: false };
    let raf = 0;
    let last = 0;
    let visible = true;

    function seed() {
      const nodeCount = Math.max(24, Math.min(110, Math.round((width * height) / 9000)));
      const beamCount = Math.max(6, Math.min(28, Math.round(width / 50)));
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.4 + 0.1,
        char: randomChar(),
      }));
      beams = Array.from({ length: beamCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 100 + 50,
        speed: Math.random() * 6 + 3,
        opacity: Math.random() * 0.5 + 0.3,
      }));
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw(step: number) {
      const palette = PALETTES[darkRef.current ? "dark" : "light"];
      const sprite = sprites[darkRef.current ? "dark" : "light"];
      ctx!.clearRect(0, 0, width, height);

      // Rising beams.
      for (const beam of beams) {
        beam.y -= beam.speed * step;
        if (beam.y + beam.length < 0) {
          beam.y = height + 100;
          beam.x = Math.random() * width;
        }
        ctx!.globalAlpha = beam.opacity;
        ctx!.drawImage(sprite, beam.x - 0.75, beam.y, 1.5, beam.length);
      }
      ctx!.globalAlpha = 1;

      // Drift and recycle nodes.
      for (const node of nodes) {
        node.y += node.vy * step;
        if (node.y > height + 20) {
          node.y = -20;
          node.x = Math.random() * width;
        }
      }

      // Neighbour lines, batched into a few paths by opacity.
      const buckets = Array.from({ length: LINK_BUCKETS }, () => new Path2D());
      const maxSquared = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const squared = dx * dx + dy * dy;
          if (squared >= maxSquared) continue;
          const strength = 1 - Math.sqrt(squared) / LINK_DISTANCE;
          const bucket = Math.min(LINK_BUCKETS - 1, Math.floor(strength * LINK_BUCKETS));
          buckets[bucket]!.moveTo(a.x, a.y);
          buckets[bucket]!.lineTo(b.x, b.y);
        }
      }
      ctx!.lineWidth = 0.5;
      buckets.forEach((path, index) => {
        ctx!.strokeStyle = `rgba(${palette.link},${(0.16 * (index + 0.5)) / LINK_BUCKETS})`;
        ctx!.stroke(path);
      });

      // Characters, with links to the pointer.
      ctx!.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (const node of nodes) {
        const near = pointer.inside ? Math.hypot(pointer.x - node.x, pointer.y - node.y) : Infinity;
        const close = near < POINTER_DISTANCE;
        if (close || Math.random() > 0.985) node.char = randomChar();
        if (close) {
          ctx!.strokeStyle = `rgba(${palette.hot},${0.45 * (1 - near / POINTER_DISTANCE)})`;
          ctx!.beginPath();
          ctx!.moveTo(node.x, node.y);
          ctx!.lineTo(pointer.x, pointer.y);
          ctx!.stroke();
        }
        ctx!.fillStyle = close ? `rgb(${palette.hot})` : `rgba(${palette.node},0.45)`;
        ctx!.fillText(node.char, node.x, node.y);
      }
    }

    function frame(now: number) {
      raf = 0;
      // Time-based motion: one step = one 60 Hz frame, capped after a stall.
      const step = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
      last = now;
      draw(step);
      if (visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    }

    function start() {
      if (reduced || raf || !visible || document.visibilityState !== "visible") return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    resize();
    draw(0);
    redrawRef.current = () => {
      if (!raf) draw(0);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!raf) draw(0);
    });
    resizeObserver.observe(wrap);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) start();
      else stop();
    });
    intersection.observe(wrap);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      redrawRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
