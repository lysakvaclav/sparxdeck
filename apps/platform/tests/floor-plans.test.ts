import { describe, expect, it } from "vitest";
import {
  PLAN_MAX_SIDE,
  centerOn,
  clampView,
  fitView,
  nudge,
  pinchView,
  planImagePath,
  planNameFromFile,
  targetSize,
  toPlanPoint,
  toScreenPoint,
  unit,
  zoomAt,
  zoomLimits,
  type View,
} from "@/lib/floor-plans";

const image = { width: 2000, height: 1000 };
const viewport = { width: 1000, height: 600 };

describe("positions on the plan", () => {
  it("stay inside the plan and are rounded", () => {
    expect(unit(-0.2)).toBe(0);
    expect(unit(1.7)).toBe(1);
    expect(unit(0.123456)).toBe(0.1235);
    expect(unit(Number.NaN)).toBe(0.5);
    expect(unit(Number.POSITIVE_INFINITY)).toBe(0.5);
  });

  it("convert between the screen and the plan both ways", () => {
    const view: View = { scale: 0.5, x: 30, y: 20 };
    const screen = toScreenPoint(view, { x: 0.25, y: 0.5 }, image);
    expect(screen).toEqual({ x: 30 + 500 * 0.5, y: 20 + 500 * 0.5 });
    expect(toPlanPoint(view, screen, image)).toEqual({ x: 0.25, y: 0.5 });
  });

  it("a click outside the plan is no position", () => {
    const view: View = { scale: 0.5, x: 30, y: 20 };
    expect(toPlanPoint(view, { x: 10, y: 100 }, image)).toBeNull();
    expect(toPlanPoint(view, { x: 30 + 1001, y: 100 }, image)).toBeNull();
    expect(toPlanPoint(view, { x: 30, y: 20 }, image)).toEqual({ x: 0, y: 0 });
  });

  it("arrow keys move a marker the same few pixels at any zoom", () => {
    const near: View = { scale: 2, x: 0, y: 0 };
    const far: View = { scale: 0.25, x: 0, y: 0 };
    const start = { x: 0.5, y: 0.5 };
    const a = nudge(start, { x: 1, y: 0 }, near, image);
    const b = nudge(start, { x: 1, y: 0 }, far, image);
    expect((a.x - start.x) * image.width * near.scale).toBeCloseTo(4, 0);
    expect((b.x - start.x) * image.width * far.scale).toBeCloseTo(4, 0);
    expect(nudge({ x: 1, y: 0 }, { x: 1, y: -1 }, near, image)).toEqual({ x: 1, y: 0 });
  });
});

describe("the view of the plan", () => {
  it("fits the whole plan, centred", () => {
    const view = fitView(image, viewport, 16);
    expect(view.scale).toBeCloseTo((1000 - 32) / 2000);
    expect(view.x).toBeCloseTo(16);
    expect(view.y).toBeCloseTo((600 - 1000 * view.scale) / 2);
    // A tall plan fits by height.
    const tall = fitView({ width: 500, height: 2000 }, viewport, 0);
    expect(tall.scale).toBeCloseTo(0.3);
    expect(tall.x).toBeCloseTo((1000 - 150) / 2);
  });

  it("zooming keeps the point under the cursor in place", () => {
    const view: View = { scale: 0.5, x: 30, y: 20 };
    const anchor = { x: 400, y: 300 };
    const before = toPlanPoint(view, anchor, image)!;
    const zoomed = zoomAt(view, 2, anchor, { min: 0.1, max: 10 });
    expect(zoomed.scale).toBe(1);
    const after = toPlanPoint(zoomed, anchor, image)!;
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("zoom stops at its limits", () => {
    const fit = fitView(image, viewport);
    const limits = zoomLimits(fit);
    expect(limits.min).toBeCloseTo(fit.scale / 2);
    expect(limits.max).toBe(4);
    expect(zoomAt(fit, 1000, { x: 0, y: 0 }, limits).scale).toBe(limits.max);
    expect(zoomAt(fit, 0.001, { x: 0, y: 0 }, limits).scale).toBe(limits.min);
  });

  it("a pinch scales by the finger distance and follows the fingers", () => {
    const view: View = { scale: 1, x: 0, y: 0 };
    const start = { view, a: { x: 100, y: 100 }, b: { x: 200, y: 100 } };
    // Fingers twice as far apart around the same middle: 2× zoom, middle stays.
    const spread = pinchView(
      start,
      { a: { x: 50, y: 100 }, b: { x: 250, y: 100 } },
      { min: 0.1, max: 10 },
    );
    expect(spread.scale).toBe(2);
    expect(toPlanPoint(spread, { x: 150, y: 100 }, image)).toEqual(
      toPlanPoint(view, { x: 150, y: 100 }, image),
    );
    // Same distance, moved 40 px right: a pan.
    const moved = pinchView(
      start,
      { a: { x: 140, y: 100 }, b: { x: 240, y: 100 } },
      { min: 0.1, max: 10 },
    );
    expect(moved).toEqual({ scale: 1, x: 40, y: 0 });
    // Fingers on the same spot don't divide by zero.
    const same = { view, a: { x: 5, y: 5 }, b: { x: 5, y: 5 } };
    expect(
      pinchView(same, { a: { x: 5, y: 5 }, b: { x: 9, y: 9 } }, { min: 0.1, max: 10 }).scale,
    ).toBe(1);
  });

  it("the plan can't be pushed off the screen", () => {
    const view: View = { scale: 0.5, x: -5000, y: 5000 };
    const kept = clampView(view, image, viewport, 80);
    // 80 px of the 1000 × 500 px plan stay visible on each axis.
    expect(kept.x).toBe(80 - 1000);
    expect(kept.y).toBe(600 - 80);
    // A plan smaller than the margin stays fully visible.
    const tiny = clampView({ scale: 0.01, x: -100, y: 0 }, image, viewport, 80);
    expect(tiny.x).toBe(0);
  });

  it("centres on a device", () => {
    const view = centerOn({ x: 0.25, y: 0.5 }, image, viewport, 1);
    expect(toScreenPoint(view, { x: 0.25, y: 0.5 }, image)).toEqual({ x: 500, y: 300 });
  });
});

describe("uploaded plans", () => {
  it("are scaled down to the stored size, never up", () => {
    expect(targetSize({ width: 8000, height: 4000 })).toEqual({
      width: PLAN_MAX_SIDE,
      height: 2048,
    });
    expect(targetSize({ width: 3000, height: 9000 })).toEqual({ width: 1365, height: 4096 });
    expect(targetSize({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 });
    expect(targetSize({ width: 100000, height: 1 })).toEqual({ width: 4096, height: 1 });
  });

  it("get a readable default name from the file", () => {
    expect(planNameFromFile("2NP_pudorys-final.pdf")).toBe("2NP pudorys final");
    expect(planNameFromFile("Přízemí.png")).toBe("Přízemí");
    expect(planNameFromFile("plan.v2.JPEG")).toBe("plan.v2");
    expect(planNameFromFile("x".repeat(300) + ".png")).toHaveLength(200);
  });

  it("are stored in the organization's folder", () => {
    expect(planImagePath("org", "site", "a.webp")).toBe("org/floor-plans/site/a.webp");
  });
});
