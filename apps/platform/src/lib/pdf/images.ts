import "server-only";
import sharp from "sharp";
import { sniffImage } from "@/lib/storage";

// Pictures for a PDF (logos, signatures, photos). react-pdf draws only some
// JPEGs and skips the rest without a word (a company's logo from a phone or
// a scanner went missing, part 22), so every picture is written anew here:
// turned upright as the camera recorded it, at most 2000 px a side, a PNG
// when it was one or has transparency, a plain JPEG otherwise.

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

const MAX_SIDE = 2000;
const MAX_PIXELS = 60_000_000;

export async function pdfImage(bytes: Buffer | Uint8Array): Promise<PdfImage | null> {
  const kind = sniffImage(bytes);
  if (!kind) return null;
  try {
    const source = sharp(bytes, { limitInputPixels: MAX_PIXELS });
    const { hasAlpha } = await source.metadata();
    const image = source
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    if (kind.ext === "png" || hasAlpha) return { data: await image.png().toBuffer(), format: "png" };
    return { data: await image.jpeg({ quality: 85 }).toBuffer(), format: "jpg" };
  } catch {
    return null;
  }
}
