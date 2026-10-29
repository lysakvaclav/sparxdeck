import type { HomeDictionary } from "@/i18n/dictionary";

// Three principles, each with an isometric line drawing. The drawings are
// built from points in space and projected, so everything lies exactly in its
// plane; shapes are listed back to front and their opaque faces hide what is
// behind them.

type Vec = [number, number, number];

type Shape = {
  points: Vec[];
  closed?: boolean;
  /** A face's fill (a theme colour); lines have none. */
  fill?: string;
  /** Line strength: 1 for the subject, less for what is behind or around it. */
  tone?: number;
  dashed?: boolean;
};

const COS30 = Math.cos(Math.PI / 6);

/** Isometric projection: x runs down to the right, y down to the left, z up. */
function project([x, y, z]: Vec): [number, number] {
  return [(x - y) * COS30, (x + y) / 2 - z];
}

/** The three visible faces of a box (left, right, top), each one opaque. */
function box([x0, y0, z0]: Vec, [dx, dy, dz]: Vec, tone = 1): Shape[] {
  const [x1, y1, z1] = [x0 + dx, y0 + dy, z0 + dz];
  return [
    { points: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], closed: true, fill: "var(--surface)", tone },
    { points: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], closed: true, fill: "var(--surface-2)", tone },
    { points: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], closed: true, fill: "var(--background)", tone },
  ];
}

/** A rectangle lying on the plane z (x0..x1 by y0..y1). */
function flatRect(x0: number, y0: number, x1: number, y1: number, z: number, tone = 1): Shape {
  return { points: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], closed: true, tone };
}

const WIDTH = 240;
const HEIGHT = 200;

/** Draws the shapes centred in a fixed frame, at the same scale in every drawing. */
function Drawing({ shapes }: { shapes: Shape[] }) {
  const projected = shapes.map((shape) => shape.points.map(project));
  const all = projected.flat();
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const at = (n: number) => Math.round(n * 100) / 100;
  return (
    <svg viewBox={`${at(cx - WIDTH / 2)} ${at(cy - HEIGHT / 2)} ${WIDTH} ${HEIGHT}`} className="h-full w-full" aria-hidden>
      {shapes.map((shape, index) => {
        const d =
          projected[index]!.map(([x, y], i) => `${i ? "L" : "M"}${at(x)} ${at(y)}`).join(" ") + (shape.closed ? " Z" : "");
        return (
          <path
            key={index}
            d={d}
            fill={shape.fill ?? "none"}
            stroke="currentColor"
            strokeOpacity={shape.tone ?? 1}
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={shape.dashed ? "3 4" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** Simple: a checklist on the top sheet of a short stack. */
function simpleShapes(): Shape[] {
  const size = 110;
  const top = 52 + 7;
  const shapes: Shape[] = [...box([0, 0, 0], [size, size, 7], 0.3), ...box([0, 0, 26], [size, size, 7], 0.55)];
  shapes.push(...box([0, 0, 52], [size, size, 7]));
  [56, 40, 48].forEach((length, row) => {
    const y = 18 + row * 28;
    shapes.push(flatRect(14, y, 32, y + 18, top));
    shapes.push({ points: [[42, y + 9, top], [42 + length, y + 9, top]], tone: 0.5 });
    if (row < 2) {
      // A tick inside the box, drawn on the sheet.
      shapes.push({ points: [[18, y + 9.5, top], [22.5, y + 14, top], [29, y + 4.5, top]] });
    }
  });
  return shapes;
}

/** Without a signal: a phone, and the records waiting in it rising once there is a connection. */
function offlineShapes(): Shape[] {
  const [w, l, t] = [56, 104, 7];
  const [cx, cy] = [w / 2, l / 2];
  const shapes: Shape[] = [...box([0, 0, 0], [w, l, t])];
  shapes.push(flatRect(5, 8, w - 5, l - 8, t, 0.5));
  [18, 30, 42].forEach((y, row) => {
    shapes.push({ points: [[12, y, t], [12 + [30, 22, 26][row]!, y, t]], tone: 0.45 });
  });
  shapes.push({ points: [[cx, cy, t], [cx, cy, 100]], tone: 0.45, dashed: true });
  [34, 58, 82].forEach((z, step) => {
    shapes.push(...box([cx - 10, cy - 10, z], [20, 20, 5], [1, 0.6, 0.35][step]));
  });
  shapes.push({ points: [[cx - 5, cy + 5, 98], [cx, cy, 104], [cx + 5, cy - 5, 98]], tone: 0.6 });
  return shapes;
}

/** Your data: a locked box inside a larger, open one. */
function dataShapes(): Shape[] {
  const s = 96;
  const v = (x: number, y: number, z: number): Vec => [x * s, y * s, z * s];
  const shapes: Shape[] = [
    // The outer box's hidden edges, behind everything.
    ...[v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)].map((end) => ({ points: [v(0, 0, 0), end], tone: 0.3, dashed: true })),
  ];
  shapes.push(...box([28, 28, 28], [40, 40, 40]));
  // A padlock on the inner box's left face (y = 68): across is x, up is z.
  const [lx, ly, lz] = [48, 68, 46];
  const on = (across: number, up: number): Vec => [lx + across, ly, lz + up];
  shapes.push({ points: [on(-8, -10), on(8, -10), on(8, 2), on(-8, 2)], closed: true });
  const shackle: Vec[] = [on(-5, 2)];
  for (let angle = 180; angle >= 0; angle -= 15) {
    const radians = (angle * Math.PI) / 180;
    shackle.push(on(5 * Math.cos(radians), 7 + 5 * Math.sin(radians)));
  }
  shackle.push(on(5, 2));
  shapes.push({ points: shackle });
  shapes.push({ points: [on(0, -3), on(0, -6)] });
  // The outer box's visible edges, in front of the inner box.
  const edges: [Vec, Vec][] = [
    [v(0, 0, 1), v(1, 0, 1)],
    [v(1, 0, 1), v(1, 1, 1)],
    [v(1, 1, 1), v(0, 1, 1)],
    [v(0, 1, 1), v(0, 0, 1)],
    [v(1, 0, 0), v(1, 1, 0)],
    [v(1, 1, 0), v(0, 1, 0)],
    [v(1, 0, 0), v(1, 0, 1)],
    [v(1, 1, 0), v(1, 1, 1)],
    [v(0, 1, 0), v(0, 1, 1)],
  ];
  shapes.push(...edges.map(([a, b]) => ({ points: [a, b], tone: 0.5 })));
  return shapes;
}

const FIGURES = [simpleShapes, offlineShapes, dataShapes];

export function Principles({ dict }: { dict: HomeDictionary }) {
  const p = dict.principles;
  return (
    <section aria-label={p.title} className="border-t border-line">
      <ul className="container-site grid md:grid-cols-3">
        {p.items.map((item, index) => {
          const shapes = (FIGURES[index] ?? simpleShapes)();
          return (
            <li
              key={item.title}
              className="flex flex-col border-line py-14 md:py-20 md:ps-10 md:first:ps-0 md:[&:not(:first-child)]:border-s max-md:[&:not(:first-child)]:border-t"
            >
              <div className="mx-auto mb-12 h-56 w-full max-w-[300px] text-main">
                <Drawing shapes={shapes} />
              </div>
              <h3 className="text-lg font-medium tracking-tight">{item.title}</h3>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-muted">{item.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
