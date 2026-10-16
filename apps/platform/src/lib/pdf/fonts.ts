import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

// The PDFs' font: Noto Sans (OFL, src/assets/fonts), embedded so Czech
// characters print the same everywhere.

export const FONT = "Noto Sans";

let registered = false;

export function registerFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  Font.register({
    family: FONT,
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Names and addresses are not split into syllables.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
