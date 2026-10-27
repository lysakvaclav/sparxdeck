import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

// What a PDF shows, page by page, in a form two renderings can be compared by:
// every piece of text with its position and size, and every image with the box
// it is drawn into, and every rule, border and shading with its colour (rounded
// to a tenth of a point). Used to prove the protocol
// looks the same after its rendering changed (part 22).

export type LayoutText = { s: string; x: number; y: number; size: number };
export type LayoutImage = { x: number; y: number; w: number; h: number };
/** A filled or stroked shape (rules, borders, shading): its box, colour and line. */
export type LayoutShape = { paint: "fill" | "stroke"; box: number[]; color: string; line: number };
export type PageLayout = {
  width: number;
  height: number;
  text: LayoutText[];
  images: LayoutImage[];
  shapes: LayoutShape[];
};

const r = (value: number) => Math.round(value * 10) / 10;

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export async function pdfLayout(pdf: Buffer | Uint8Array): Promise<PageLayout[]> {
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    verbosity: 0,
  });
  const document = await task.promise;
  const pages: PageLayout[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items.flatMap((item) =>
      "str" in item && item.str.trim()
        ? [
            {
              s: item.str,
              x: r(item.transform[4]),
              y: r(item.transform[5]),
              size: r(Math.hypot(item.transform[2], item.transform[3])),
            },
          ]
        : [],
    );
    // Images: follow the transformation matrix through the drawing operators.
    const list = await page.getOperatorList();
    const images: LayoutImage[] = [];
    const shapes: LayoutShape[] = [];
    type State = { ctm: Matrix; fill: string; stroke: string; line: number };
    let state: State = { ctm: [1, 0, 0, 1, 0, 0], fill: "", stroke: "", line: 1 };
    const stack: State[] = [];
    const point = (x: number, y: number) => [
      state.ctm[0] * x + state.ctm[2] * y + state.ctm[4],
      state.ctm[1] * x + state.ctm[3] * y + state.ctm[5],
    ];
    list.fnArray.forEach((fn, index) => {
      const args = list.argsArray[index] as unknown[];
      if (fn === OPS.save) stack.push({ ...state });
      else if (fn === OPS.restore) state = stack.pop() ?? state;
      else if (fn === OPS.transform) state = { ...state, ctm: multiply(state.ctm, args as Matrix) };
      else if (fn === OPS.setFillRGBColor) state = { ...state, fill: String(args) };
      else if (fn === OPS.setStrokeRGBColor) state = { ...state, stroke: String(args) };
      else if (fn === OPS.setLineWidth) state = { ...state, line: r(args[0] as number) };
      else if (fn === OPS.paintImageXObject)
        images.push({ x: r(state.ctm[4]), y: r(state.ctm[5]), w: r(state.ctm[0]), h: r(state.ctm[3]) });
      else if (fn === OPS.constructPath) {
        const [op, , minMax] = args as [number, unknown, ArrayLike<number> | null];
        if (!minMax) return;
        const stroke = op === OPS.stroke || op === OPS.closeStroke;
        if (!stroke && op !== OPS.fill && op !== OPS.eoFill && op !== OPS.fillStroke) return;
        const [x0, y0] = point(minMax[0]!, minMax[1]!);
        const [x1, y1] = point(minMax[2]!, minMax[3]!);
        shapes.push({
          paint: stroke ? "stroke" : "fill",
          box: [x0!, y0!, x1!, y1!].map(r),
          color: stroke ? state.stroke : state.fill,
          line: stroke ? state.line : 0,
        });
      }
    });
    pages.push({ width: r(viewport.width), height: r(viewport.height), text, images, shapes });
    page.cleanup();
  }
  await task.destroy();
  return pages;
}
