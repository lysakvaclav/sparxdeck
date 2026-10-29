import type { ShotName } from "@/components/site/Screenshot";
import type { PagesDictionary } from "@/i18n/dictionary";

/**
 * The product's features, in the order of home.features in the dictionaries:
 * the page about each (if any) and the screenshots that show it.
 */
export const FEATURES: {
  /** Path under /<locale>/; null when there is no page about it. */
  path: string | null;
  page: keyof PagesDictionary | null;
  /** One desktop screenshot, or two phone ones. */
  shot: { desktop: ShotName } | { phones: [ShotName, ShotName] };
}[] = [
  { path: "equipment-register", page: "equipmentRegister", shot: { desktop: "devices" } },
  { path: "field-inspections", page: "fieldInspections", shot: { phones: ["check", "today"] } },
  { path: "inspection-reports", page: "inspectionReports", shot: { desktop: "protocol" } },
  { path: "deadline-tracking", page: "deadlineTracking", shot: { desktop: "calendar" } },
  { path: "defect-tracking", page: "defectTracking", shot: { desktop: "defects" } },
  { path: null, page: null, shot: { desktop: "route" } },
];
