"use client";

import type React from "react";
import { RadarChartLite } from "./radar-chart-lite";

interface RadarChartProps {
  width: number;
  height: number;
  data: number[];
  getValue?: (d: number) => number;
  levels?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  labels?: string[];
}

export function Component({ width, height, data, getValue, levels, margin, labels }: RadarChartProps) {
  const values = (data || []).map((d) => (getValue ? getValue(d) : d));

  return (
    <RadarChartLite
      width={width}
      height={height}
      values={values}
      levels={levels}
      labels={labels}
      margin={margin}
    />
  );
}
