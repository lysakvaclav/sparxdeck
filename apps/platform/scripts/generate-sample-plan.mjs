// Renders the sample floor plan (scripts/sample-floor-plan.svg) to
// src/assets/sample/floor-plan.webp, used by the sample data.
// Run from apps/platform: node scripts/generate-sample-plan.mjs
import fs from "node:fs";
import sharp from "sharp";

const source = fs.readFileSync(new URL("./sample-floor-plan.svg", import.meta.url));
const out = new URL("../src/assets/sample/floor-plan.webp", import.meta.url);
fs.mkdirSync(new URL(".", out), { recursive: true });
const { width, height, size } = await sharp(source)
  .webp({ quality: 86 })
  .toFile(out.pathname.replace(/^\/(\w:)/, "$1"));
console.log(`floor-plan.webp ${width}×${height}, ${Math.round(size / 1024)} kB`);
