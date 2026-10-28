import "server-only";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";

// The PDFs' fonts (OFL, src/assets/fonts), embedded so Czech characters print
// the same everywhere: Noto Sans for every PDF, and the fonts a protocol
// template may choose (part 22): Noto Serif and Inter. Each in regular, bold
// and both italics.

export const FONT = "Noto Sans";

/** A template's font (schema `style.font`) as the family registered here. */
export const FONT_FAMILIES = {
  "noto-sans": "Noto Sans",
  "noto-serif": "Noto Serif",
  inter: "Inter",
} as const;

const FILES: Record<string, string> = {
  "Noto Sans": "NotoSans",
  "Noto Serif": "NotoSerif",
  Inter: "Inter",
};

let registered = false;

/**
 * Registers the fonts, and gives every document its own copy of them.
 * react-pdf keeps one parsed font for the whole process, and a document drawn
 * after certain others (a template with little text, part 22) lost letters
 * ("yhovuje" for "Vyhovuje"); a fresh copy per document costs a few
 * milliseconds.
 */
function registerFonts() {
  if (registered) {
    for (const family of Object.values(Font.getRegisteredFonts()))
      for (const source of family.sources) {
        if (typeof source.src !== "string" || !source.src.endsWith(".ttf")) continue;
        source.data = null;
        source.loadResultPromise = null;
      }
    return;
  }
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  for (const [family, file] of Object.entries(FILES))
    Font.register({
      family,
      fonts: [
        { src: path.join(dir, `${file}-Regular.ttf`), fontWeight: 400 },
        { src: path.join(dir, `${file}-Bold.ttf`), fontWeight: 700 },
        { src: path.join(dir, `${file}-Italic.ttf`), fontWeight: 400, fontStyle: "italic" },
        { src: path.join(dir, `${file}-BoldItalic.ttf`), fontWeight: 700, fontStyle: "italic" },
      ],
    });
  // Names and addresses are not split into syllables.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders a PDF document. One at a time in this process: each gets a fresh
 * copy of the fonts (above), which must not change under a render in progress.
 */
export function renderPdf(document: Parameters<typeof renderToBuffer>[0]): Promise<Buffer> {
  const run = queue.then(() => {
    registerFonts();
    return renderToBuffer(document);
  });
  queue = run.catch(() => undefined);
  return run;
}
