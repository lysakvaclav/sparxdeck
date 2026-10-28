// Generates the brand's files for both apps from two sources in src/assets/brand:
// * mark.svg (the mark, traced from mark-source.png): browser tab, home screen
//   and PWA icons of the platform, the landing page's favicon.ico and icons;
// * text-logo-source.png (the text logo on white): text-logo.png, a mask that
//   the TextLogo components paint in the current text colour (light and dark).
// Run from apps/platform: node scripts/generate-app-icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const MARK = "src/assets/brand/mark.svg";
const TEXT_SOURCE = "src/assets/brand/text-logo-source.png";
const LANDING = "../landingpage";
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** The mark at `size` px, sharp at any size (rendered from the vector). */
const mark = (size) =>
  sharp(MARK, { density: Math.max(72, Math.ceil((72 * size) / 440) * 2) })
    .resize(size, size)
    .png()
    .toBuffer();

/** The mark taking `share` of a square of `size`, on `background`. */
async function icon(size, share, background, file) {
  const inner = Math.round(size * share);
  const png = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await mark(inner), gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (file) {
    fs.writeFileSync(file, png);
    console.log(file);
  }
  return png;
}

/** A Windows icon file holding PNG images (every current browser reads them). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

// The platform: PWA icons and the Next.js file conventions (<link rel="icon">,
// <link rel="apple-touch-icon">).
fs.mkdirSync("public/icons", { recursive: true });
await icon(192, 0.9, CLEAR, "public/icons/icon-192.png");
await icon(512, 0.9, CLEAR, "public/icons/icon-512.png");
// Android crops maskable icons to a circle or squircle and fills nothing:
// the mark's own black square fills the whole icon.
await icon(512, 1, CLEAR, "public/icons/icon-maskable-512.png");
await icon(96, 0.94, CLEAR, "src/app/icon.png");
// iOS rounds the corners itself and shows transparency as black: on white.
await icon(180, 0.8, WHITE, "src/app/apple-icon.png");

// The landing page: favicon.ico (16, 32, 48) and the same icons.
const sizes = [16, 32, 48];
const favicon = ico(await Promise.all(sizes.map(async (size) => ({ size, png: await icon(size, 1, CLEAR) }))));
fs.writeFileSync(`${LANDING}/src/app/favicon.ico`, favicon);
console.log(`${LANDING}/src/app/favicon.ico`);
await icon(96, 0.94, CLEAR, `${LANDING}/src/app/icon.png`);
await icon(180, 0.8, WHITE, `${LANDING}/src/app/apple-icon.png`);

// The text logo as a mask: black where the logo is, transparent elsewhere,
// trimmed to the logo (the mark on the left takes the full height, so a square
// crop shows just the mark).
const { data, info } = await sharp(TEXT_SOURCE)
  .flatten({ background: WHITE })
  .greyscale()
  .trim({ threshold: 40 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i++) rgba[i * 4 + 3] = 255 - data[i];
const textLogo = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toBuffer();
for (const file of ["src/assets/brand/text-logo.png", `${LANDING}/src/assets/brand/text-logo.png`]) {
  fs.writeFileSync(file, textLogo);
  console.log(`${file} (${info.width}x${info.height})`);
}
