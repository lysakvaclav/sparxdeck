// Generates the app's icons (browser tab, home screen, PWA) from the brand mark
// in src/assets/brand/mark.png. Run from apps/platform: node scripts/generate-app-icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const SOURCE = "src/assets/brand/mark.png";
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// The mark without its margins, on white (the source is a near-white JPEG-ish PNG).
const mark = await sharp(SOURCE).flatten({ background: WHITE }).trim({ threshold: 40 }).toBuffer();

/** The mark centred on a white square, taking `share` of its width. */
async function icon(size, share, file) {
  const inner = Math.round(size * share);
  const resized = await sharp(mark)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: resized, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(file);
}

fs.mkdirSync("public/icons", { recursive: true });
await icon(192, 0.78, "public/icons/icon-192.png");
await icon(512, 0.78, "public/icons/icon-512.png");
// Android crops maskable icons to a circle or squircle: keep the mark in the safe zone.
await icon(512, 0.56, "public/icons/icon-maskable-512.png");
// Next.js file conventions: <link rel="icon"> and <link rel="apple-touch-icon">.
await icon(96, 0.86, "src/app/icon.png");
await icon(180, 0.72, "src/app/apple-icon.png");
