import "server-only";
import sharp from "sharp";
import type { ErrorCode } from "@/lib/errors";
import { MAX_LOGO_BYTES, sniffImage } from "@/lib/storage";
import { looksLikeSvg, sanitizeSvg } from "@/lib/svg-sanitize";

// A protocol template's own logo (part 22, stage C): PNG, JPEG, WebP or SVG
// up to 2 MB, recognised by its content (not its name), stored as a PNG at
// most 1600 × 800. An SVG is cleaned first (src/lib/svg-sanitize.ts) and
// drawn here, so the protocol only ever gets a picture.

/** Huge pictures (or SVGs claiming huge sizes) are refused before decoding. */
const MAX_PIXELS = 40_000_000;
const BOX = { width: 1600, height: 800 };

export async function templateLogoPng(bytes: Uint8Array): Promise<{ png: Buffer } | { error: ErrorCode }> {
  if (bytes.length === 0) return { error: "fileTypeInvalid" };
  if (bytes.length > MAX_LOGO_BYTES) return { error: "fileTooLarge" };
  try {
    if (looksLikeSvg(bytes)) {
      const svg = sanitizeSvg(new TextDecoder().decode(bytes));
      if (!svg) return { error: "fileTypeInvalid" };
      const png = await sharp(Buffer.from(svg), { density: 288, limitInputPixels: MAX_PIXELS })
        .resize({ ...BOX, fit: "inside" })
        .png()
        .toBuffer();
      return { png };
    }
    const kind = sniffImage(bytes);
    if (!kind) return { error: "fileTypeInvalid" };
    const png = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ ...BOX, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { png };
  } catch {
    return { error: "fileTypeInvalid" };
  }
}
