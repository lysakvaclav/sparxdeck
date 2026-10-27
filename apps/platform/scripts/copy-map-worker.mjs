// Copies MapLibre's web worker next to the app's public files. MapLibre 6 loads
// its worker as a separate module from beside its own bundle, which Next.js
// doesn't serve; the map (src/app/(app)/map/site-map-canvas.tsx) points
// setWorkerUrl here. Runs before `dev` and `build`, so the copy always matches
// the installed version (not committed).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const target = path.join(process.cwd(), "public", "vendor");
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(
  path.join(dist, "maplibre-gl-worker.mjs"),
  path.join(target, "maplibre-gl-worker.mjs"),
);
console.log("MapLibre worker copied to public/vendor/");
