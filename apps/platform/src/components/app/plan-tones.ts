import type { DueState } from "@/lib/due";
import type { MarkerTone } from "./plan-viewer";

/** Marker colour of a device on a plan by its due state (shared by server and client). */
export const DUE_TONE: Record<DueState, MarkerTone> = {
  overdue: "danger",
  soon: "warning",
  ok: "success",
  never: "neutral",
};
