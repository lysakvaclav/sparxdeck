"use client";

import React from "react";

type Props = {
  width: number;
  height: number;
  levels?: number;
  values: number[]; // e.g. 0..100
  labels?: string[];
  margin?: { top: number; right: number; bottom: number; left: number };
};

const chartBg = "var(--background)";
const axisColor = "var(--color-border)";
const strokeColor = "var(--color-text-strong)";

export function RadarChartLite({
  width,
  height,
  levels = 5,
  values,
  labels,
  margin = { top: 40, right: 40, bottom: 40, left: 40 },
}: Props) {
  if (!values || values.length === 0 || width < 10 || height < 10) return null;

  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const radius = Math.max(0, Math.min(xMax, yMax) / 2);
  const cx = margin.left + xMax / 2;
  const cy = margin.top + yMax / 2;

  const N = values.length;
  const maxValue = Math.max(...values, 0);
  const angleStep = (Math.PI * 2) / N;

  const scale = (v: number) => radius * (v / (maxValue || 1));

  const gridRadii = Array.from({ length: levels }, (_, i) => (radius * (i + 1)) / levels);

  const axisPoints = Array.from({ length: N }, (_, i) => {
    const a = i * angleStep;
    return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a), angle: a };
  });

  const dataPoints = values.map((v, i) => {
    const a = i * angleStep;
    const r = scale(v);
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill={chartBg} rx={14} />

      {/* Grid */}
      {gridRadii.map((r, idx) => (
        <circle
          key={`grid-${idx}`}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={axisColor}
          strokeWidth={2}
          strokeOpacity={0.8}
        />
      ))}

      {/* Axes */}
      {axisPoints.map((p, i) => (
        <line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={axisColor} />
      ))}

      {/* Labels */}
      {labels && labels.length === N &&
        labels.map((label, i) => {
          const p = axisPoints[i];
          // Keep labels comfortably inside the chart background
          const labelRadius = radius * 0.86;
          const tx = cx + labelRadius * Math.sin(p.angle);
          const ty = cy - labelRadius * Math.cos(p.angle);

          // Simple word-wrapping into max ~16 characters per line
          const words = label.split(" ");
          const lines: string[] = [];
          let currentLine = "";
          const maxChars = 16;

          for (const word of words) {
            const test = currentLine ? `${currentLine} ${word}` : word;
            if (test.length > maxChars && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = test;
            }
          }
          if (currentLine) lines.push(currentLine);

          let anchor: "start" | "middle" | "end" = "middle";
          const sin = Math.sin(p.angle);
          if (Math.abs(sin) > 0.5) {
            // On the right side, anchor text inward (to the left), on the left side inward (to the right)
            anchor = sin > 0 ? "end" : "start";
          }

          const lineHeight = 12;

          return (
            <text
              key={`label-${i}`}
              x={tx}
              y={ty - ((lines.length - 1) * lineHeight) / 2}
              fill="var(--color-text-muted)"
              fontSize={11}
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {lines.map((ln, idx) => (
                <tspan key={idx} x={tx} dy={idx === 0 ? 0 : lineHeight}>
                  {ln}
                </tspan>
              ))}
            </text>
          );
        })}

      {/* Data polygon */}
      {polygonPoints && (
        <polygon
          points={polygonPoints}
          fill={strokeColor}
          fillOpacity={0.12}
          stroke={strokeColor}
          strokeWidth={1}
        />
      )}

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3} fill={strokeColor} />
      ))}
    </svg>
  );
}
