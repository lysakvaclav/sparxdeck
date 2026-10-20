"use client";

import { forwardRef, useImperativeHandle, useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  clear: () => void;
  /** A PNG, base64 without the "data:" prefix; null while the pad is empty. */
  toPngBase64: () => string | null;
};

type Point = { x: number; y: number };

/**
 * A finger- or mouse-drawn signature. Always dark ink on white, regardless of
 * the app's theme: it stands for a mark on paper, not a themed UI element.
 * Coordinates are mapped by the CSS-to-canvas ratio at draw time, so the
 * canvas can be any displayed size without recomputing it on resize.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string; label: string }>(
  function SignaturePad({ className, label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const empty = useRef(true);
    const last = useRef<Point | null>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => empty.current,
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        empty.current = true;
      },
      toPngBase64: () => {
        const canvas = canvasRef.current;
        if (!canvas || empty.current) return null;
        return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      },
    }));

    function point(event: PointerEvent<HTMLCanvasElement>): Point | null {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: ((event.clientX - rect.left) * canvas.width) / rect.width,
        y: ((event.clientY - rect.top) * canvas.height) / rect.height,
      };
    }

    function start(event: PointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      // Keeps a fast finger drawing past the canvas edge; harmless if denied.
      try {
        canvasRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      drawing.current = true;
      last.current = point(event);
    }

    function move(event: PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const next = point(event);
      if (!canvas || !ctx || !next) return;
      ctx.strokeStyle = "#111418";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo((last.current ?? next).x, (last.current ?? next).y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last.current = next;
      empty.current = false;
    }

    function end(event: PointerEvent<HTMLCanvasElement>) {
      drawing.current = false;
      last.current = null;
      try {
        canvasRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    return (
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        role="img"
        aria-label={label}
        className={cn("touch-none rounded-md border border-[var(--border)] bg-white", className)}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
    );
  },
);
