// Label sheets: an A4 page cut into a grid of labels. Everything in millimetres;
// the PDF and the on-screen preview both draw from these numbers.

export const PAGE = { width: 210, height: 297 } as const;

export type SheetLayout = {
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  /** From the page's top and left edge to the first label. */
  marginTop: number;
  marginLeft: number;
  /** Space between neighbouring labels. */
  gapX: number;
  gapY: number;
};

/** Common A4 label sheets, by label size. */
export const SHEET_PRESETS = ["70x37", "70x42", "63x38", "52x30", "48x25", "105x37"] as const;
export type SheetPreset = (typeof SHEET_PRESETS)[number];
export const DEFAULT_PRESET: SheetPreset = "70x37";

export const PRESET_LAYOUTS: Record<SheetPreset, SheetLayout> = {
  "70x37": grid(3, 8, 70, 37, 0.5, 0),
  "70x42": grid(3, 7, 70, 42.3, 0.45, 0),
  "63x38": { ...grid(3, 7, 63.5, 38.1, 15.15, 7.25), gapX: 2.5 },
  "52x30": grid(4, 10, 52.5, 29.7, 0, 0),
  "48x25": grid(4, 11, 48.5, 25.4, 8.8, 8),
  "105x37": grid(2, 8, 105, 37, 0.5, 0),
};

function grid(
  columns: number,
  rows: number,
  labelWidth: number,
  labelHeight: number,
  marginTop: number,
  marginLeft: number,
): SheetLayout {
  return { columns, rows, labelWidth, labelHeight, marginTop, marginLeft, gapX: 0, gapY: 0 };
}

/** Limits of a custom sheet: smaller labels would shrink the QR modules below 0.3 mm. */
export const CUSTOM_LIMITS = {
  columns: { min: 1, max: 10 },
  rows: { min: 1, max: 20 },
  labelWidth: { min: 35, max: PAGE.width },
  labelHeight: { min: 20, max: PAGE.height },
  margin: { min: 0, max: 50 },
  gap: { min: 0, max: 20 },
} as const;

/** Most labels printed at once (devices × copies). */
export const MAX_LABELS = 1000;

export function perSheet(layout: SheetLayout): number {
  return layout.columns * layout.rows;
}

/** The grid fits on A4 (half a millimetre of slack for rounded published sizes). */
export function fitsPage(layout: SheetLayout): boolean {
  const width =
    layout.marginLeft + layout.columns * layout.labelWidth + (layout.columns - 1) * layout.gapX;
  const height =
    layout.marginTop + layout.rows * layout.labelHeight + (layout.rows - 1) * layout.gapY;
  return width <= PAGE.width + 0.5 && height <= PAGE.height + 0.5;
}

/** Top-left corner of a cell (0-based, row by row). */
export function cellPosition(layout: SheetLayout, cell: number): { x: number; y: number } {
  const column = cell % layout.columns;
  const row = Math.floor(cell / layout.columns) % layout.rows;
  return {
    x: layout.marginLeft + column * (layout.labelWidth + layout.gapX),
    y: layout.marginTop + row * (layout.labelHeight + layout.gapY),
  };
}

export type PlacedLabel = { page: number; cell: number; x: number; y: number };

/**
 * Where `count` labels go when printing starts at cell `startAt` (1-based) of
 * the first sheet: row by row, then on to the next sheet. Starting later lets a
 * partly used sheet go back into the printer.
 */
export function placeLabels(layout: SheetLayout, count: number, startAt = 1): PlacedLabel[] {
  const slots = perSheet(layout);
  const offset = Math.min(Math.max(startAt, 1), slots) - 1;
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index;
    const cell = position % slots;
    return { page: Math.floor(position / slots), cell, ...cellPosition(layout, cell) };
  });
}

export function sheetCount(layout: SheetLayout, count: number, startAt = 1): number {
  if (count <= 0) return 0;
  const offset = Math.min(Math.max(startAt, 1), perSheet(layout)) - 1;
  return Math.ceil((offset + count) / perSheet(layout));
}

/** Every device repeated `copies` times, copies side by side. */
export function withCopies<T>(items: readonly T[], copies: number): T[] {
  return items.flatMap((item) => Array.from({ length: copies }, () => item));
}

export type LabelContent = {
  padding: number;
  /** QR code box (including its quiet zone). */
  qr: { x: number; y: number; size: number };
  /** Area for the label number, building and company name. */
  text: { x: number; y: number; width: number; height: number };
  /** Font sizes in millimetres. */
  numberSize: number;
  nameSize: number;
  footerSize: number;
  /** Lines the building name may take. */
  nameLines: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Inside a label: the QR code on the left (or on top of a tall label), the label
 * number in bold next to it, then the building and the company. Sizes follow
 * the label, so every sheet format reads the same.
 */
export function labelContent(width: number, height: number): LabelContent {
  const padding = clamp(Math.min(width, height) * 0.08, 2, 4);
  const tall = height > width * 1.2;
  if (tall) {
    const size = Math.min(width - 2 * padding, height * 0.6);
    const top = padding + size + padding * 0.6;
    const text = { x: padding, y: top, width: width - 2 * padding, height: height - top - padding };
    return {
      padding,
      qr: { x: (width - size) / 2, y: padding, size },
      text,
      ...fontSizes(width, text.height),
    };
  }
  const size = Math.min(height - 2 * padding, width * 0.48);
  const left = padding + size + padding * 0.8;
  const text = { x: left, y: padding, width: width - left - padding, height: height - 2 * padding };
  return { padding, qr: { x: padding, y: (height - size) / 2, size }, text, ...fontSizes(height) };
}

function fontSizes(height: number, available = height) {
  const numberSize = clamp(height * 0.16, 3.4, 7);
  const nameSize = clamp(height * 0.075, 2, 3.2);
  const footerSize = clamp(nameSize * 0.82, 1.8, 2.6);
  // Room left under the number and above the company name decides the lines.
  const free = available - numberSize * 1.25 - footerSize * 1.6;
  const nameLines = clamp(Math.floor(free / (nameSize * 1.25)), 1, 3);
  return { numberSize, nameSize, footerSize, nameLines };
}

/** The measurements of a custom sheet, as form fields. */
export const CUSTOM_FIELDS = [
  "columns",
  "rows",
  "labelWidth",
  "labelHeight",
  "marginTop",
  "marginLeft",
  "gapX",
  "gapY",
] as const;
export type CustomField = (typeof CUSTOM_FIELDS)[number];

/** Last sheet format and copies, remembered per browser so the next print starts there. */
export const LABELS_COOKIE = "sd_labels";

export type LabelPrefs = {
  preset: SheetPreset | "custom";
  custom: Record<CustomField, string>;
  copies: string;
};

export function customFields(layout: SheetLayout): Record<CustomField, string> {
  return Object.fromEntries(CUSTOM_FIELDS.map((key) => [key, String(layout[key])])) as Record<
    CustomField,
    string
  >;
}

export function defaultLabelPrefs(): LabelPrefs {
  return {
    preset: DEFAULT_PRESET,
    custom: customFields(PRESET_LAYOUTS[DEFAULT_PRESET]),
    copies: "1",
  };
}

/** Reads the remembered preferences; anything unexpected falls back to the defaults. */
export function readLabelPrefs(raw: string | undefined): LabelPrefs {
  const defaults = defaultLabelPrefs();
  if (!raw) return defaults;
  try {
    // Browsers send the value percent-encoded, as it was written.
    const text = raw.startsWith("%7B") ? decodeURIComponent(raw) : raw;
    const value = JSON.parse(text) as Partial<LabelPrefs>;
    const preset = ([...SHEET_PRESETS, "custom"] as const).find((p) => p === value.preset);
    const custom = value.custom;
    const customOk =
      !!custom &&
      typeof custom === "object" &&
      CUSTOM_FIELDS.every((key) => typeof custom[key] === "string" && custom[key].length <= 8);
    return {
      preset: preset ?? defaults.preset,
      custom: customOk
        ? (Object.fromEntries(CUSTOM_FIELDS.map((key) => [key, custom[key]])) as Record<
            CustomField,
            string
          >)
        : defaults.custom,
      copies:
        typeof value.copies === "string" && /^\d{1,2}$/.test(value.copies)
          ? value.copies
          : defaults.copies,
    };
  } catch {
    return defaults;
  }
}
