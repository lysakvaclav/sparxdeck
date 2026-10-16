import { encode } from "uqr";

// QR codes on device labels. The code holds nothing but the label URL with the
// device's random token: no names, addresses or other personal data.

/** The address a device label points to. */
export function labelUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/d/${token}`;
}

export type QrMatrix = { size: number; modules: boolean[][] };

/**
 * QR modules (true = dark) without a quiet zone. Error correction level Q: a
 * label can lose about a quarter of its code to dirt or scratches and still scan.
 */
export function qrMatrix(text: string): QrMatrix {
  const { size, data } = encode(text, { ecc: "Q", border: 0 });
  return { size, modules: data };
}

/**
 * All dark modules as one SVG path in module units (adjacent modules in a row
 * merged), so a sheet of labels stays small and prints crisp.
 */
export function qrPath(matrix: QrMatrix): string {
  let path = "";
  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end++;
      path += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return path;
}

/** Light modules kept around the code so scanners find its edges. */
export const QR_QUIET_ZONE = 2;
