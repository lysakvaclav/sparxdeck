// Floor plans: positions relative to the plan image, the view (pan and zoom) of
// the plan on screen, and the size an uploaded plan is stored at. Pure functions
// shared by the browser and the server, covered by tests.

/** Longer side of a stored plan image, in pixels: sharp enough to read room labels. */
export const PLAN_MAX_SIDE = 4096;
/** Stored plan images stay under the org-assets bucket limit (2 MB). */
export const PLAN_MAX_BYTES = 1_900_000;
/** What the browser may hand to the converter (a large PDF or photo of a plan). */
export const PLAN_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
/** Upper bound for the image the server accepts (matches the database check). */
export const PLAN_MAX_DIMENSION = 10_000;

export type Size = { width: number; height: number };
/** A point on screen (pixels) or on the plan (0..1 from the left and top). */
export type Point = { x: number; y: number };
/** Screen position of the plan: screen = plan pixel × scale + offset. */
export type View = { scale: number; x: number; y: number };
export type ZoomLimits = { min: number; max: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A coordinate on the plan, kept inside it and rounded (0.0001 ≈ 0.4 px on 4096 px). */
export function unit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.round(clamp(value, 0, 1) * 10_000) / 10_000;
}

/** The size a plan is stored at: at most PLAN_MAX_SIDE on the longer side, never enlarged. */
export function targetSize(source: Size, maxSide = PLAN_MAX_SIDE): Size {
  const longer = Math.max(source.width, source.height);
  const scale = longer > maxSide ? maxSide / longer : 1;
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/** The whole plan in the viewport, centred, with some room around it. */
export function fitView(image: Size, viewport: Size, padding = 16): View {
  const room = (length: number) => Math.max(1, length - 2 * padding);
  const scale = Math.min(room(viewport.width) / image.width, room(viewport.height) / image.height);
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
}

/** From half the fitted size to 4 screen pixels per plan pixel (or 8× the fit on small plans). */
export function zoomLimits(fit: View): ZoomLimits {
  return { min: fit.scale / 2, max: Math.max(4, fit.scale * 8) };
}

/**
 * Keeps part of the plan on screen: at least `margin` pixels of it (or all of
 * it, when smaller) stay inside the viewport on each axis.
 */
export function clampView(view: View, image: Size, viewport: Size, margin = 80): View {
  const axis = (offset: number, length: number, room: number) => {
    const keep = Math.min(margin, length, room);
    return clamp(offset, keep - length, room - keep);
  };
  return {
    scale: view.scale,
    x: axis(view.x, image.width * view.scale, viewport.width),
    y: axis(view.y, image.height * view.scale, viewport.height),
  };
}

/** Zooms by `factor` keeping the plan point under `anchor` (screen) where it is. */
export function zoomAt(view: View, factor: number, anchor: Point, limits: ZoomLimits): View {
  const scale = clamp(view.scale * factor, limits.min, limits.max);
  const k = scale / view.scale;
  return { scale, x: anchor.x - (anchor.x - view.x) * k, y: anchor.y - (anchor.y - view.y) * k };
}

/**
 * Two fingers: the plan point that was under the starting midpoint follows the
 * current midpoint, and the scale follows the distance between the fingers.
 */
export function pinchView(
  start: { view: View; a: Point; b: Point },
  now: { a: Point; b: Point },
  limits: ZoomLimits,
): View {
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const from = distance(start.a, start.b);
  const ratio = from > 0 ? distance(now.a, now.b) / from : 1;
  const scale = clamp(start.view.scale * ratio, limits.min, limits.max);
  const m0 = middle(start.a, start.b);
  const m1 = middle(now.a, now.b);
  const planX = (m0.x - start.view.x) / start.view.scale;
  const planY = (m0.y - start.view.y) / start.view.scale;
  return { scale, x: m1.x - planX * scale, y: m1.y - planY * scale };
}

/** The plan position (0..1) under a screen point, or null outside the plan. */
export function toPlanPoint(view: View, screen: Point, image: Size): Point | null {
  const x = (screen.x - view.x) / (view.scale * image.width);
  const y = (screen.y - view.y) / (view.scale * image.height);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: unit(x), y: unit(y) };
}

/** Where a plan position (0..1) is on screen. */
export function toScreenPoint(view: View, point: Point, image: Size): Point {
  return {
    x: view.x + point.x * image.width * view.scale,
    y: view.y + point.y * image.height * view.scale,
  };
}

/** A view with the plan position in the middle of the viewport, at `scale`. */
export function centerOn(point: Point, image: Size, viewport: Size, scale: number): View {
  return {
    scale,
    x: viewport.width / 2 - point.x * image.width * scale,
    y: viewport.height / 2 - point.y * image.height * scale,
  };
}

/** Arrow keys move a marker by a few screen pixels, whatever the zoom. */
export function nudge(point: Point, direction: Point, view: View, image: Size, pixels = 4): Point {
  return {
    x: unit(point.x + (direction.x * pixels) / (image.width * view.scale)),
    y: unit(point.y + (direction.y * pixels) / (image.height * view.scale)),
  };
}

/** A plan's default name from its file: "2NP_pudorys-final.pdf" → "2NP pudorys final". */
export function planNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{1,5}$/i, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Where a plan image is stored: always inside the organization's folder. */
export function planImagePath(organizationId: string, siteId: string, file: string): string {
  return `${organizationId}/floor-plans/${siteId}/${file}`;
}
