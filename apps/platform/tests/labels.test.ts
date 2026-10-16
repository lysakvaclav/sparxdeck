import fs from "node:fs";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { normalizeToken } from "@/lib/devices";
import {
  CUSTOM_LIMITS,
  PAGE,
  PRESET_LAYOUTS,
  SHEET_PRESETS,
  cellPosition,
  fitsPage,
  labelContent,
  perSheet,
  placeLabels,
  sheetCount,
  withCopies,
} from "@/lib/labels";
import { QR_QUIET_ZONE, labelUrl, qrMatrix, qrPath, type QrMatrix } from "@/lib/qr";
import { labelPrintSchema, sheetLayoutOf } from "@/lib/validation";

/** Paints a QR matrix into RGBA pixels and reads it back like a phone camera would. */
function scan(matrix: QrMatrix, scale = 4): string | null {
  const modules = matrix.size + QR_QUIET_ZONE * 2;
  const side = modules * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.modules[y]![x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (x + QR_QUIET_ZONE) * scale + dx;
          const py = (y + QR_QUIET_ZONE) * scale + dy;
          pixels.fill(0, (py * side + px) * 4, (py * side + px) * 4 + 3);
        }
      }
    }
  }
  return jsQR(pixels, side, side)?.data ?? null;
}

describe("QR codes on labels", () => {
  it("hold exactly the label URL and scan back", () => {
    for (const url of [
      labelUrl("https://app.sparxdeck.com", "0123456789ab"),
      labelUrl("https://app.sparxdeck.com/", "zyxwvtsrqpnm"),
      labelUrl("http://192.168.1.20:3001", "h7k2m9p4q8r3"),
    ]) {
      expect(scan(qrMatrix(url)), url).toBe(url);
    }
    expect(labelUrl("https://app.sparxdeck.com///", "0123456789ab")).toBe(
      "https://app.sparxdeck.com/d/0123456789ab",
    );
  });

  it("draw one compact path of the dark modules", () => {
    const matrix = qrMatrix(labelUrl("https://app.sparxdeck.com", "0123456789ab"));
    // A production URL fits a small code (version 4: 33 modules), even at level Q.
    expect(matrix.size).toBeLessThanOrEqual(33);
    const path = qrPath(matrix);
    expect(path.startsWith("M0 0h7v1h-7z")).toBe(true); // the top-left finder pattern
    const dark = matrix.modules.flat().filter(Boolean).length;
    const covered = [...path.matchAll(/h(\d+)v1/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(covered).toBe(dark);
  });

  it("accepts tokens as printed, in any letter case", () => {
    expect(normalizeToken(" H7K2M9P4Q8R3 ")).toBe("h7k2m9p4q8r3");
    for (const bad of ["", "h7k2m9p4q8r", "h7k2m9p4q8r3x", "h7k2m9p4q8ri", "../etc/passwd"])
      expect(normalizeToken(bad), bad).toBeNull();
  });
});

describe("label sheets", () => {
  it("every preset fits on A4 without overlapping labels", () => {
    for (const preset of SHEET_PRESETS) {
      const layout = PRESET_LAYOUTS[preset];
      expect(fitsPage(layout), preset).toBe(true);
      const last = cellPosition(layout, perSheet(layout) - 1);
      expect(last.x + layout.labelWidth, preset).toBeLessThanOrEqual(PAGE.width + 0.5);
      expect(last.y + layout.labelHeight, preset).toBeLessThanOrEqual(PAGE.height + 0.5);
    }
    expect(perSheet(PRESET_LAYOUTS["70x37"])).toBe(24);
    expect(perSheet(PRESET_LAYOUTS["48x25"])).toBe(44);
  });

  it("places labels row by row, from a chosen start, onto further sheets", () => {
    const layout = PRESET_LAYOUTS["70x37"];
    const placed = placeLabels(layout, 5, 23);
    expect(placed.map((p) => [p.page, p.cell])).toEqual([
      [0, 22],
      [0, 23],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(placed[0]).toMatchObject({ x: 70, y: 0.5 + 7 * 37 });
    expect(placed[2]).toMatchObject({ x: 0, y: 0.5 });
    expect(sheetCount(layout, 24)).toBe(1);
    expect(sheetCount(layout, 25)).toBe(2);
    expect(sheetCount(layout, 2, 24)).toBe(2);
    expect(sheetCount(layout, 0)).toBe(0);
    // A start outside the sheet is clamped.
    expect(placeLabels(layout, 1, 99)[0]!.cell).toBe(23);
    expect(withCopies(["a", "b"], 3)).toEqual(["a", "a", "a", "b", "b", "b"]);
  });

  it("lays out the content inside every label size", () => {
    const sizes = [
      ...SHEET_PRESETS.map((preset) => PRESET_LAYOUTS[preset]),
      { labelWidth: CUSTOM_LIMITS.labelWidth.min, labelHeight: CUSTOM_LIMITS.labelHeight.min },
      { labelWidth: 30, labelHeight: 60 },
      { labelWidth: 210, labelHeight: 297 },
    ];
    for (const { labelWidth: w, labelHeight: h } of sizes) {
      const c = labelContent(w, h);
      const label = `${w}×${h}`;
      expect(c.qr.x, label).toBeGreaterThanOrEqual(c.padding - 1e-9);
      expect(c.qr.x + c.qr.size, label).toBeLessThanOrEqual(w - c.padding + 1e-9);
      expect(c.qr.y + c.qr.size, label).toBeLessThanOrEqual(h - c.padding + 1e-9);
      expect(c.text.width, label).toBeGreaterThan(5);
      expect(c.text.x + c.text.width, label).toBeLessThanOrEqual(w + 1e-9);
      expect(c.text.y + c.text.height, label).toBeLessThanOrEqual(h + 1e-9);
      expect(c.nameLines, label).toBeGreaterThanOrEqual(1);
      // QR modules stay large enough for a phone camera (≥ 0.3 mm).
      expect(c.qr.size / 41, label).toBeGreaterThanOrEqual(0.3);
    }
    // A tall label puts the code on top.
    const tall = labelContent(30, 60);
    expect(tall.text.y).toBeGreaterThan(tall.qr.y + tall.qr.size);
  });
});

describe("label print requests", () => {
  const id = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
  const base = { deviceIds: [id], copies: "1", startAt: "1", preset: "70x37" };
  const issue = (input: object) =>
    labelPrintSchema.safeParse({ ...base, ...input }).error?.issues[0]?.message;

  it("accepts a preset or a custom sheet that fits", () => {
    const parsed = labelPrintSchema.parse({ ...base, copies: "2", startAt: "24" });
    expect(sheetLayoutOf(parsed)).toBe(PRESET_LAYOUTS["70x37"]);
    const custom = {
      columns: "2",
      rows: "5",
      labelWidth: "90",
      labelHeight: "50",
      marginTop: "10",
      marginLeft: "10",
      gapX: "5",
      gapY: "2",
    };
    const ok = labelPrintSchema.parse({ ...base, preset: "custom", custom });
    expect(sheetLayoutOf(ok)).toMatchObject({ columns: 2, labelWidth: 90, gapY: 2 });
  });

  it("explains what is wrong", () => {
    expect(issue({ deviceIds: [] })).toBe("labelsNone");
    expect(issue({ deviceIds: ["nope"] })).toBe("labelsNone");
    expect(issue({ copies: "0" })).toBe("copiesInvalid");
    expect(issue({ copies: "11" })).toBe("copiesInvalid");
    expect(issue({ startAt: "25" })).toBe("startInvalid");
    expect(issue({ deviceIds: Array(200).fill(id), copies: "6" })).toBe("labelsTooMany");
    expect(issue({ preset: "custom" })).toBe("layoutInvalid");
    const tooWide = {
      columns: "3",
      rows: "1",
      labelWidth: "80",
      labelHeight: "30",
      marginTop: "0",
      marginLeft: "0",
      gapX: "0",
      gapY: "0",
    };
    expect(issue({ preset: "custom", custom: tooWide })).toBe("labelsDontFit");
    expect(issue({ preset: "custom", custom: { ...tooWide, labelWidth: "10" } })).toBe(
      "layoutInvalid",
    );
  });
});

describe("label PDF", async () => {
  const { renderLabelsPdf } = await import("@/lib/pdf/labels");

  it("renders sheets with Czech text and one page per sheet", async () => {
    const labels = Array.from({ length: 30 }, (_, index) => ({
      number: String(index + 1).padStart(4, "0"),
      siteName:
        index === 0
          ? "Žluťoučký kůň úpěl ďábelské ódy, Příčná 12, vchod A, budova se dlouhým názvem"
          : "Lipová 12, vchod A",
      url: labelUrl("https://app.sparxdeck.com", "0123456789ab"),
    }));
    const pdf = await renderLabelsPdf({
      labels,
      layout: PRESET_LAYOUTS["70x37"],
      startAt: 1,
      organizationName: "Revize Novák s.r.o.",
      title: "Štítky Lipová 12",
    });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
    // The font is embedded (subset), so č, ř, ž print on any computer.
    expect(text).toMatch(/\/FontFile2/);
    fs.mkdirSync(".e2e-output", { recursive: true });
    fs.writeFileSync(".e2e-output/labels-sample.pdf", pdf);
  });
});
