import "server-only";
import { cache } from "react";
import { formatLabel } from "@/lib/devices";
import { HOLD_MINUTES, type Question } from "@/lib/inspections";
import type { CheckOutcome, CheckSkipReason } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

/** An inspection with its building and customer; RLS limits it to the user's company. */
export const getInspection = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspections")
    .select("*, site:sites(id, name, address, access_notes, customer:customers(id, name, email))")
    .eq("id", id)
    .maybeSingle();
  return data;
});

/** Display names of the organization's members, by user id. */
export const memberNames = cache(async (organizationId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, display_name")
    .eq("organization_id", organizationId);
  return new Map((data ?? []).map((row) => [row.user_id, row.display_name]));
});

export type RunDevice = {
  id: string;
  number: string;
  labelNumber: number;
  token: string;
  typeName: string;
  locationName: string | null;
  serialNumber: string | null;
};

export type RunCheck = {
  outcome: CheckOutcome | null;
  /** Left out (inaccessible, missing): handled, but not checked. */
  skipReason: CheckSkipReason | null;
  /** A colleague holding the check right now (not the current user). */
  heldBy: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
};

/**
 * The building's active devices in route order (locations as on the building,
 * devices without one last) and the state of each device's check.
 */
export async function loadInspectionRun(
  inspection: { id: string; site_id: string; organization_id: string },
  userId: string,
) {
  const supabase = await createClient();
  const [devices, items, names] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("devices")
        .select(
          "id, label_number, public_token, serial_number, location:locations(name, sort_order), type:device_types(name)",
        )
        .eq("site_id", inspection.site_id)
        .is("deleted_at", null)
        .eq("status", "active")
        .order("label_number")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("inspection_items")
        .select("device_id, outcome, skip_reason, editing_by, editing_at, checked_by, checked_at")
        .eq("inspection_id", inspection.id)
        .order("id")
        .range(from, to),
    ),
    memberNames(inspection.organization_id),
  ]);

  const holdLimit = Date.now() - HOLD_MINUTES * 60_000;
  const checks: Record<string, RunCheck> = {};
  for (const item of items) {
    const held =
      item.editing_by &&
      item.editing_by !== userId &&
      item.editing_at &&
      Date.parse(item.editing_at) > holdLimit;
    checks[item.device_id] = {
      outcome: item.outcome,
      skipReason: item.skip_reason,
      heldBy: held ? (names.get(item.editing_by!) ?? "?") : null,
      checkedBy: item.checked_by ? (names.get(item.checked_by) ?? null) : null,
      checkedAt: item.checked_at,
    };
  }

  const ordered = devices.sort(
    (a, b) =>
      (a.location?.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.location?.sort_order ?? Number.MAX_SAFE_INTEGER) || a.label_number - b.label_number,
  );
  const runDevices: RunDevice[] = ordered.map((device) => ({
    id: device.id,
    number: formatLabel(device.label_number),
    labelNumber: device.label_number,
    token: device.public_token,
    typeName: device.type?.name ?? "",
    locationName: device.location?.name ?? null,
    serialNumber: device.serial_number,
  }));
  return { devices: runDevices, checks };
}

/** The questions of a checklist version, in order. */
export async function loadQuestions(templateId: string): Promise<Question[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checklist_template_items")
    .select("id, label, item_type, required, fail_creates_defect, sort_order")
    .eq("template_id", templateId)
    .order("sort_order");
  return (data ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    type: item.item_type,
    required: item.required,
    failCreatesDefect: item.fail_creates_defect,
  }));
}

/** The building's inspection in progress, if any (for "continue" buttons). */
export async function openInspectionOf(siteId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspections")
    .select("id")
    .eq("site_id", siteId)
    .eq("status", "in_progress")
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * What completing the inspection will do with failed answers, as
 * complete_inspection does it: a failure is added to the open defect of the same
 * question on the device; otherwise it records a new defect when the question
 * always does or a severity was chosen.
 */
export async function defectPreview(
  inspectionId: string,
): Promise<{ created: number; observed: number }> {
  const supabase = await createClient();
  const answers = await fetchAll((from, to) =>
    supabase
      .from("inspection_answers")
      .select(
        "id, defect_severity, item:inspection_items!inner(device_id, inspection_id), question:checklist_template_items!inner(label, item_type, fail_creates_defect)",
      )
      .eq("item.inspection_id", inspectionId)
      .eq("value_pass", false)
      .order("id")
      .range(from, to),
  );
  const failed = answers.filter((answer) => answer.question.item_type === "pass_fail");
  if (failed.length === 0) return { created: 0, observed: 0 };

  const devices = [...new Set(failed.map((answer) => answer.item.device_id))];
  const open = new Set<string>();
  for (let start = 0; start < devices.length; start += 100) {
    const { data } = await supabase
      .from("defects")
      .select("device_id, question:checklist_template_items(label)")
      .in("device_id", devices.slice(start, start + 100))
      .neq("status", "resolved");
    for (const defect of data ?? [])
      if (defect.question) open.add(`${defect.device_id}\n${defect.question.label}`);
  }
  let created = 0;
  let observed = 0;
  for (const answer of failed) {
    const key = `${answer.item.device_id}\n${answer.question.label}`;
    if (open.has(key)) observed++;
    else if (answer.question.fail_creates_defect || answer.defect_severity !== null) {
      created++;
      open.add(key);
    }
  }
  return { created, observed };
}
