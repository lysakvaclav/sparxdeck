import { QR_QUIET_ZONE, qrMatrix, qrPath } from "@/lib/qr";
import { cn } from "@/lib/utils";

/**
 * A QR code as SVG: black on white in both themes (a scanner needs the contrast),
 * crisp at any size. Works on the server and in the browser.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** Accessible name, e.g. "QR code of label 0012". */
  label: string;
  className?: string;
}) {
  const matrix = qrMatrix(value);
  const box = matrix.size + QR_QUIET_ZONE * 2;
  return (
    <svg
      viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${box} ${box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      <rect x={-QR_QUIET_ZONE} y={-QR_QUIET_ZONE} width={box} height={box} fill="#ffffff" />
      <path d={qrPath(matrix)} fill="#000000" />
    </svg>
  );
}
