"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  PLAN_MAX_BYTES,
  PLAN_MAX_SIDE,
  PLAN_SOURCE_MAX_BYTES,
  targetSize,
  type Size,
} from "@/lib/floor-plans";

// A floor plan is prepared in the browser: a photo or image is scaled to the
// stored size, a PDF page is rendered (vector plans come out sharp), and the
// result is encoded as WebP (JPEG where the browser can't encode WebP) under
// the storage limit. The server then checks the result by its content.

export type PlanErrorCode = "fileTypeInvalid" | "fileTooLarge" | "planUnreadable";

export class PlanImageError extends Error {
  constructor(readonly code: PlanErrorCode) {
    super(code);
  }
}

export type PlanSource =
  | { kind: "image"; image: HTMLImageElement; size: Size }
  | { kind: "pdf"; document: PDFDocumentProxy; pages: number };

export type PreparedPlan = { blob: Blob; size: Size };

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PlanImageError("fileTypeInvalid"));
    };
    image.src = url;
  });
}

async function isPdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === "%PDF-";
}

/** pdf.js only when a PDF is chosen; the worker comes from our own origin (CSP). */
async function loadPdf(file: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      // Fonts missing from the PDF come from the system, not from the network.
      useSystemFonts: true,
    }).promise;
  } catch {
    throw new PlanImageError("planUnreadable");
  }
}

/** Opens a chosen file: an image the browser can show, or a PDF. */
export async function openPlanSource(file: File): Promise<PlanSource> {
  if (file.size === 0) throw new PlanImageError("fileTypeInvalid");
  if (file.size > PLAN_SOURCE_MAX_BYTES) throw new PlanImageError("fileTooLarge");
  if (await isPdf(file)) {
    const document = await loadPdf(file);
    return { kind: "pdf", document, pages: document.numPages };
  }
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new PlanImageError("fileTypeInvalid");
  return { kind: "image", image, size: { width: image.naturalWidth, height: image.naturalHeight } };
}

/** A canvas with the source drawn on white (transparent plans would turn black in JPEG). */
async function draw(source: PlanSource, page: number, maxSide: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new PlanImageError("planUnreadable");

  if (source.kind === "image") {
    const size = targetSize(source.size, maxSide);
    canvas.width = size.width;
    canvas.height = size.height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(source.image, 0, 0, size.width, size.height);
    return canvas;
  }

  try {
    const pdfPage = await source.document.getPage(page);
    const base = pdfPage.getViewport({ scale: 1 });
    // Vector plans are rendered at the full stored size, small pages included.
    const viewport = pdfPage.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await pdfPage.render({ canvas, viewport, background: "#ffffff" }).promise;
    return canvas;
  } catch {
    throw new PlanImageError("planUnreadable");
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Renders the plan (for a PDF, the given page) into an image for upload: the
 * stored size first, then smaller or more compressed until it fits.
 */
export async function preparePlan(source: PlanSource, page = 1): Promise<PreparedPlan> {
  for (const [side, quality] of [
    [PLAN_MAX_SIDE, 0.86],
    [PLAN_MAX_SIDE, 0.72],
    [3200, 0.72],
    [2560, 0.7],
    [2048, 0.68],
  ] as const) {
    const canvas = await draw(source, page, side);
    let blob = await encode(canvas, "image/webp", quality);
    // Safari before 17 can't encode WebP and quietly returns PNG.
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
    if (blob && blob.size <= PLAN_MAX_BYTES) {
      return { blob, size: { width: canvas.width, height: canvas.height } };
    }
  }
  throw new PlanImageError("fileTooLarge");
}

/** A small preview of the prepared plan for the upload dialog. */
export function previewUrl(plan: PreparedPlan): string {
  return URL.createObjectURL(plan.blob);
}
