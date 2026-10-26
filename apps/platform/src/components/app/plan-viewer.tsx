"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoomInIcon, ZoomOutIcon, ZoomToFitIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  centerOn,
  clampView,
  fitView,
  nudge,
  pinchView,
  toPlanPoint,
  toScreenPoint,
  unit,
  zoomAt,
  zoomLimits,
  type Point,
  type Size,
  type View,
} from "@/lib/floor-plans";
import { cn } from "@/lib/utils";

export type MarkerTone = "danger" | "warning" | "success" | "neutral" | "muted";

export type PlanMarker = {
  id: string;
  /** Position on the plan, 0..1 from the left and top. */
  x: number;
  y: number;
  /** Short text in the marker (the label number). */
  label: string;
  /** Accessible name: label, type and state. */
  description: string;
  tone: MarkerTone;
};

// Dots are graphics on a white chip: each has at least 3:1 contrast to white.
const TONE: Record<MarkerTone, string> = {
  danger: "bg-[#db3737]",
  warning: "bg-[#bf7326]",
  success: "bg-[#0f9960]",
  neutral: "bg-[#738694]",
  muted: "bg-[#a7b6c2]",
};

/** A tap that moves less than this is a tap, not a drag. */
const TAP_SLOP = 5;

type Gesture =
  | { kind: "pan"; pointer: number; start: Point; view: View; moved: boolean; onMarker: boolean }
  | { kind: "pinch"; a: number; b: number; start: { view: View; a: Point; b: Point } };

type Drag = { id: string; pointer: number; start: Point; point: Point; moved: boolean };

/** Steering the view from outside (e.g. a device picked in a list). */
export type PlanViewerHandle = { centerOn: (id: string) => void; fit: () => void };

/**
 * A floor plan with device markers: drag or two fingers to move, wheel, double
 * click or two fingers to zoom. Markers keep their size on screen. When
 * `editable`, markers can be dragged and the selected one moved with the arrow
 * keys; when `placing`, a tap on the plan reports where.
 */
export function PlanViewer({
  name,
  imageUrl,
  size,
  markers,
  selectedId = null,
  onSelect,
  editable = false,
  onMove,
  placing = false,
  onPlace,
  focusId = null,
  onReload,
  fitShape = false,
  className,
  children,
  ref,
}: {
  ref?: React.Ref<PlanViewerHandle>;
  name: string;
  imageUrl: string | null;
  size: Size;
  markers: PlanMarker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  editable?: boolean;
  onMove?: (id: string, point: Point) => void;
  placing?: boolean;
  onPlace?: (point: Point) => void;
  /** Centre on this marker when the plan first shows. */
  focusId?: string | null;
  /** Fresh image URL (signed URLs expire). */
  onReload?: () => void;
  /** Height follows the plan's shape (within the class's min and max height). */
  fitShape?: boolean;
  className?: string;
  /** Overlay on top of the plan (e.g. a hint while placing). */
  children?: React.ReactNode;
}) {
  const t = useTranslations("plans.viewer");
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const touched = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  // The drag lives in a ref (pointer events can outrun rendering on a busy
  // page); the state only draws the dragged marker where it is.
  const dragging = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const updateDrag = (next: Drag | null) => {
    dragging.current = next;
    setDrag(next);
  };
  // Which image URL loaded or failed (a fresh signed URL starts loading again).
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Once the plan has shown, a fresh URL of the same image (signed URLs change)
  // keeps the markers: the browser shows the old image until the new one loads.
  const status = !imageUrl
    ? "failed"
    : failedUrl === imageUrl
      ? "failed"
      : loadedUrl
        ? "ready"
        : "loading";

  const apply = useCallback(
    (next: View, room: Size | null = viewport) => {
      const kept = room ? clampView(next, size, room) : next;
      viewRef.current = kept;
      setView(kept);
    },
    [size, viewport],
  );

  const fit = useCallback(() => {
    if (!viewport) return;
    touched.current = false;
    apply(fitView(size, viewport), viewport);
  }, [apply, size, viewport]);

  // The viewport size; the first one decides the starting view.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const room = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (room.width < 10 || room.height < 10) return;
      setViewport(room);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!viewport) return;
    const fitted = fitView(size, viewport);
    const current = viewRef.current;
    if (!current) {
      const focus = focusId ? markers.find((marker) => marker.id === focusId) : undefined;
      const limits = zoomLimits(fitted);
      const start = focus
        ? centerOn(focus, size, viewport, Math.min(limits.max, fitted.scale * 2.5))
        : fitted;
      if (focus) touched.current = true;
      apply(start, viewport);
    } else if (!touched.current) {
      apply(fitted, viewport);
    } else {
      apply(current, viewport);
    }
    // Only a new viewport or image size re-runs this (markers and focus are read once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, size.width, size.height]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      centerOn(id: string) {
        const marker = markers.find((item) => item.id === id);
        const current = viewRef.current;
        if (!marker || !current || !viewport) return;
        touched.current = true;
        const fitted = fitView(size, viewport);
        const scale = Math.min(zoomLimits(fitted).max, Math.max(current.scale, fitted.scale * 1.6));
        apply(centerOn(marker, size, viewport, scale));
      },
    }),
    [apply, fit, markers, size, viewport],
  );

  const limits = viewport ? zoomLimits(fitView(size, viewport)) : { min: 0.01, max: 8 };

  const zoomBy = useCallback(
    (factor: number, anchor?: Point) => {
      const current = viewRef.current;
      if (!current || !viewport) return;
      touched.current = true;
      const at = anchor ?? { x: viewport.width / 2, y: viewport.height / 2 };
      apply(zoomAt(current, factor, at, zoomLimits(fitView(size, viewport))));
    },
    [apply, size, viewport],
  );

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const step = event.deltaMode === 1 ? 0.05 : 0.0015;
      zoomBy(Math.exp(-event.deltaY * step), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const local = (event: { clientX: number; clientY: number }): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // Plan position under a screen point, kept on the plan (for dragging past the edge).
  const planPoint = (screen: Point, current: View): Point => ({
    x: unit((screen.x - current.x) / (current.scale * size.width)),
    y: unit((screen.y - current.y) / (current.scale * size.height)),
  });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const current = viewRef.current;
    if (!current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const onMarker = Boolean((event.target as HTMLElement).closest("[data-marker]"));
    if (pointers.current.size === 1) {
      gesture.current = {
        kind: "pan",
        pointer: event.pointerId,
        start: point,
        view: current,
        moved: false,
        onMarker,
      };
    } else if (pointers.current.size === 2) {
      const [[a, pa], [b, pb]] = [...pointers.current.entries()] as [
        [number, Point],
        [number, Point],
      ];
      gesture.current = { kind: "pinch", a, b, start: { view: current, a: pa, b: pb } };
      containerRef.current?.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;
    if (!current) return;
    if (current.kind === "pinch") {
      const a = pointers.current.get(current.a);
      const b = pointers.current.get(current.b);
      if (!a || !b) return;
      touched.current = true;
      apply(pinchView(current.start, { a, b }, limits));
      return;
    }
    if (current.pointer !== event.pointerId) return;
    const dx = point.x - current.start.x;
    const dy = point.y - current.start.y;
    if (!current.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    if (!current.moved) {
      current.moved = true;
      // Captured only once it's a drag, so taps still reach the markers.
      containerRef.current?.setPointerCapture(event.pointerId);
    }
    touched.current = true;
    apply({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = local(event);
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (current?.kind === "pinch") {
      // One finger left: it carries on panning from here (never a tap).
      const [rest] = [...pointers.current.entries()];
      gesture.current =
        rest && viewRef.current
          ? {
              kind: "pan",
              pointer: rest[0],
              start: rest[1],
              view: viewRef.current,
              moved: true,
              onMarker: false,
            }
          : null;
      return;
    }
    gesture.current = null;
    if (
      event.type !== "pointerup" ||
      !current ||
      current.moved ||
      current.onMarker ||
      !viewRef.current
    )
      return;
    // A tap on the plan itself.
    const target = toPlanPoint(viewRef.current, point, size);
    if (placing) {
      if (target) onPlace?.(target);
    } else {
      onSelect?.(null);
    }
  }

  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-marker], [data-toolbar]") || placing) return;
    zoomBy(2, local(event));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== containerRef.current || !viewRef.current) return;
    const pan = (dx: number, dy: number) => {
      event.preventDefault();
      touched.current = true;
      apply({ ...viewRef.current!, x: viewRef.current!.x + dx, y: viewRef.current!.y + dy });
    };
    if (event.key === "+" || event.key === "=") zoomBy(1.4);
    else if (event.key === "-") zoomBy(1 / 1.4);
    else if (event.key === "0") fit();
    else if (event.key === "ArrowLeft") pan(60, 0);
    else if (event.key === "ArrowRight") pan(-60, 0);
    else if (event.key === "ArrowUp") pan(0, 60);
    else if (event.key === "ArrowDown") pan(0, -60);
  }

  // --- Markers: dragging (editable) and arrow keys on the selected one -------

  function onMarkerPointerDown(event: React.PointerEvent<HTMLButtonElement>, marker: PlanMarker) {
    if (!editable || placing || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDrag({
      id: marker.id,
      pointer: event.pointerId,
      start: local(event),
      point: { x: marker.x, y: marker.y },
      moved: false,
    });
  }

  function onMarkerPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = dragging.current;
    if (!current || current.pointer !== event.pointerId || !viewRef.current) return;
    event.stopPropagation();
    const point = local(event);
    if (
      !current.moved &&
      Math.hypot(point.x - current.start.x, point.y - current.start.y) < TAP_SLOP
    )
      return;
    updateDrag({ ...current, moved: true, point: planPoint(point, viewRef.current) });
  }

  function onMarkerPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const current = dragging.current;
    if (!current || current.pointer !== event.pointerId) return;
    event.stopPropagation();
    if (current.moved && event.type === "pointerup") onMove?.(current.id, current.point);
    updateDrag(null);
  }

  function onMarkerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, marker: PlanMarker) {
    if (!editable || !viewRef.current) return;
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    if (selectedId !== marker.id) onSelect?.(marker.id);
    onMove?.(marker.id, nudge(marker, direction, viewRef.current, size, event.shiftKey ? 20 : 4));
  }

  const shown = view;

  return (
    <div
      ref={containerRef}
      role="group"
      tabIndex={0}
      aria-label={t("label", { name })}
      aria-roledescription="map"
      dir="ltr"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      style={fitShape ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
      className={cn(
        "relative touch-none overflow-hidden bg-[#e1e8ed] outline-none select-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] dark:bg-[#202b33]",
        placing ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      {imageUrl && shown && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, scaled by transform
        <img
          src={imageUrl}
          alt={t("label", { name })}
          draggable={false}
          onLoad={() => setLoadedUrl(imageUrl)}
          onError={() => setFailedUrl(imageUrl)}
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(${shown.x}px, ${shown.y}px) scale(${shown.scale})`,
          }}
          className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left bg-white shadow-elevation-2"
        />
      )}

      {shown && status === "ready" && (
        <div className="pointer-events-none absolute inset-0">
          {markers.map((marker) => {
            const dragged = drag?.id === marker.id ? drag.point : null;
            const position = toScreenPoint(shown, dragged ?? marker, size);
            const selected = selectedId === marker.id;
            return (
              <button
                key={marker.id}
                type="button"
                data-marker={marker.id}
                aria-label={marker.description}
                aria-pressed={onSelect ? selected : undefined}
                onClick={() => onSelect?.(marker.id)}
                onPointerDown={(event) => onMarkerPointerDown(event, marker)}
                onPointerMove={onMarkerPointerMove}
                onPointerUp={onMarkerPointerUp}
                onPointerCancel={onMarkerPointerUp}
                onKeyDown={(event) => onMarkerKeyDown(event, marker)}
                style={{ left: position.x, top: position.y }}
                className={cn(
                  "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none pointer-coarse:min-h-11 pointer-coarse:min-w-11",
                  editable ? "cursor-move" : "cursor-pointer",
                  (selected || dragged) && "z-10",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full bg-white py-[3px] ps-[5px] pe-1.5 font-mono text-[11px] leading-none font-semibold text-[#182026] tabular-nums shadow-[0_0_0_1px_rgb(16_22_26/0.25),0_1px_3px_rgb(16_22_26/0.35)] transition-transform",
                    selected && "scale-110 shadow-[0_0_0_2px_#29333c,0_2px_6px_rgb(16_22_26/0.4)]",
                    dragged && "scale-110",
                    "[button:focus-visible>&]:shadow-[0_0_0_2px_#29333c,0_0_0_4px_rgb(41_51_60/0.35)]",
                  )}
                >
                  <span aria-hidden className={cn("size-2.5 rounded-full", TONE[marker.tone])} />
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-ui text-muted-foreground">
          {status === "loading" ? (
            <Spinner label={t("loading")} />
          ) : (
            <>
              <p>{t("failed")}</p>
              {onReload && (
                <Button variant="outline" onClick={onReload}>
                  {t("reload")}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {children}

      <div
        data-toolbar
        className="absolute end-2.5 top-2.5 flex flex-col overflow-hidden rounded-md bg-background shadow-elevation-2"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button variant="ghost" size="icon" aria-label={t("zoomIn")} onClick={() => zoomBy(1.4)}>
          <ZoomInIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("zoomOut")}
          onClick={() => zoomBy(1 / 1.4)}
        >
          <ZoomOutIcon />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("fit")} onClick={fit}>
          <ZoomToFitIcon />
        </Button>
      </div>
    </div>
  );
}

/** The meaning of the marker colours, under a plan. */
export function PlanLegend({
  items,
  className,
}: {
  items: { tone: MarkerTone; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <ul
      className={cn("flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-muted-foreground", className)}
    >
      {items.map((item) => (
        <li key={item.tone + item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", TONE[item.tone])} />
          <span>
            {item.label}
            {item.count !== undefined && <span className="tabular-nums"> ({item.count})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
