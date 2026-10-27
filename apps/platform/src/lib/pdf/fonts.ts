import "server-only";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";

// The PDFs' font: Noto Sans (OFL, src/assets/fonts), embedded so Czech
// characters print the same everywhere.

export const FONT = "Noto Sans";

let registered = false;

/**
 * Registers the font, and gives every document its own copy of it. react-pdf
 * keeps one parsed font for the whole process, and a document drawn after
 * certain others (a template with little text, part 22) lost letters ("yhovuje"
 * for "Vyhovuje"); a fresh copy per document costs a few milliseconds.
 */
function registerFonts() {
  if (registered) {
    for (const source of Font.getRegisteredFonts()[FONT]?.sources ?? []) {
      source.data = null;
      source.loadResultPromise = null;
    }
    return;
  }
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

let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders a PDF document. One at a time in this process: each gets a fresh
 * copy of the font (above), which must not change under a render in progress.
 */
export function renderPdf(document: Parameters<typeof renderToBuffer>[0]): Promise<Buffer> {
  const run = queue.then(() => {
    registerFonts();
    return renderToBuffer(document);
  });
  queue = run.catch(() => undefined);
  return run;
}
