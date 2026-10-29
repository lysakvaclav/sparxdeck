"use client";

import { useEffect, useRef } from "react";
import logo from "@/assets/brand/text-logo.png";

/** Distance between particles and their size, in CSS pixels. */
const GAP = 5;
const SIZE = 2;
/** How far the pointer pushes particles away. */
const RADIUS = 90;

type Particle = { x: number; y: number; homeX: number; homeY: number; vx: number; vy: number };

/**
 * The text logo drawn in particles that move out of the pointer's way and
 * settle back. Decorative; still for reduced motion. The colour is the text
 * colour, so it follows the theme.
 */
export function Wordmark() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let colour = "";
    let frame = 0;
    let running = false;
    const pointer = { x: 0, y: 0, inside: false };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = colour;
      for (const p of particles) context.fillRect(p.x - SIZE / 2, p.y - SIZE / 2, SIZE, SIZE);
    };

    const image = new Image();
    const build = () => {
      if (!image.naturalWidth) return;
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      // The logo fitted into the box, read back pixel by pixel.
      const sample = document.createElement("canvas");
      sample.width = Math.ceil(width);
      sample.height = Math.ceil(height);
      const sampleContext = sample.getContext("2d");
      if (!sampleContext) return;
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      sampleContext.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      particles = [];
      for (let y = 0; y < sample.height; y += GAP) {
        for (let x = 0; x < sample.width; x += GAP) {
          if (pixels[(y * sample.width + x) * 4 + 3]! > 128) {
            particles.push({ x, y, homeX: x, homeY: y, vx: 0, vy: 0 });
          }
        }
      }
      draw();
    };

    const step = () => {
      let moving = false;
      for (const p of particles) {
        if (pointer.inside) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < RADIUS && distance > 0.01) {
            const push = ((RADIUS - distance) / RADIUS) * 2.4;
            p.vx += (dx / distance) * push;
            p.vy += (dy / distance) * push;
          }
        }
        p.vx = (p.vx + (p.homeX - p.x) * 0.05) * 0.84;
        p.vy = (p.vy + (p.homeY - p.y) * 0.05) * 0.84;
        p.x += p.vx;
        p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.02 || Math.abs(p.x - p.homeX) + Math.abs(p.y - p.homeY) > 0.2) {
          moving = true;
        }
      }
      draw();
      // Runs only while something moves; at rest the canvas just stays drawn.
      if (moving || pointer.inside) frame = window.requestAnimationFrame(step);
      else running = false;
    };

    const start = () => {
      if (still || running) return;
      running = true;
      frame = window.requestAnimationFrame(step);
    };

    const readColour = () => {
      colour = getComputedStyle(canvas).color;
      draw();
    };

    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.inside = true;
      start();
    };
    const leave = () => {
      pointer.inside = false;
      start();
    };

    image.onload = () => {
      readColour();
      build();
    };
    image.src = logo.src;

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    const resize = new ResizeObserver(build);
    resize.observe(canvas);
    // next-themes switches the theme with a class on <html>.
    const theme = new MutationObserver(readColour);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      resize.disconnect();
      theme.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="block h-full w-full text-strong" />;
}
