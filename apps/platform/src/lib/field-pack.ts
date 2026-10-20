import "server-only";
import { getLocale } from "next-intl/server";
import { isManager } from "@/lib/auth";
import { deviceTypeFields, formatLabel } from "@/lib/devices";
import type { FieldItem, FieldPack, OpenDefect } from "@/lib/field";
import { sitePlacements, sitePlans } from "@/lib/floor-plans-data";
import { getInspection, memberNames } from "@/lib/inspection-data";
import { HOLD_MINUTES, type AnswerDraft, type Question } from "@/lib/inspections";
import { ORG_ASSETS_BUCKET, SIGNED_URL_SECONDS } from "@/lib/storage";
import type { MemberRole } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

type Inspection = NonNullable<Awaited<ReturnType<typeof getInspection>>>;

/**
 * Everything the phone needs to do the inspection without a signal: the
 * building's devices in route order, each check as the server has it, the
 * checklists, open defects, floor plans and what adding a device needs.
 * RLS limits every query to the user's company.
 */
export async function loadFieldPack(
  inspection: Inspection,
  member: { userId: string; role: MemberRole },
): Promise<FieldPack> {
  const supabase = await createClient();
  const locale = await getLocale();
  const siteId = inspection.site_id;

  const [devices, items, answers, photos, names, plans, placements, types, locations, actives] =
    await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("devices")
          .select(
            "id, label_number, public_token, serial_number, device_type_id, last_inspection_on, location:locations(name, sort_order), type:device_types(name)",
          )
          .eq("site_id", siteId)
          .is("deleted_at", null)
          .eq("status", "active")
          .order("label_number")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        supabase
          .from("inspection_items")
          .select(
            "id, device_id, template_id, outcome, skip_reason, notes, editing_by, editing_at, checked_by, checked_at",
          )
          .eq("inspection_id", inspection.id)
          .order("id")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        supabase
          .from("inspection_answers")
          .select(
            "item_id, template_item_id, value_pass, value_number, value_text, note, defect_severity, item:inspection_items!inner(inspection_id)",
          )
          .eq("item.inspection_id", inspection.id)
          .order("id")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        supabase
          .from("inspection_photos")
          .select(
            "id, item_id, template_item_id, storage_path, item:inspection_items!inner(inspection_id)",
          )
          .eq("item.inspection_id", inspection.id)
          .order("created_at")
          .range(from, to),
      ),
      memberNames(inspection.organization_id),
      sitePlans(siteId),
      sitePlacements(siteId),
      supabase
        .from("device_types")
        .select("id, name, code, custom_fields")
        .eq("organization_id", inspection.organization_id)
        .eq("active", true)
        .order("created_at"),
      supabase
        .from("locations")
        .select("id, name")
        .eq("site_id", siteId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("checklist_templates")
        .select("id, device_type_id")
        .eq("organization_id", inspection.organization_id)
        .eq("active", true),
    ]);

  // Checklists: the active version of each type, and any version a check uses.
  const activeTemplates: Record<string, string> = {};
  for (const template of actives.data ?? []) activeTemplates[template.device_type_id] = template.id;
  const templateIds = [
    ...new Set([
      ...Object.values(activeTemplates),
      ...items.flatMap((item) => (item.template_id ? [item.template_id] : [])),
    ]),
  ];
  const questionRows = templateIds.length
    ? await fetchAll((from, to) =>
        supabase
          .from("checklist_template_items")
          .select("id, template_id, label, item_type, required, fail_creates_defect, sort_order")
          .in("template_id", templateIds)
          .order("sort_order")
          .order("id")
          .range(from, to),
      )
    : [];
  const templates: Record<string, Question[]> = {};
  for (const id of templateIds) templates[id] = [];
  for (const row of questionRows)
    templates[row.template_id]?.push({
      id: row.id,
      label: row.label,
      type: row.item_type,
      required: row.required,
      failCreatesDefect: row.fail_creates_defect,
    });

  // Open defects of the building's devices (a "no" to their question is added to them).
  const deviceIds = devices.map((device) => device.id);
  const defects: Record<string, OpenDefect[]> = {};
  for (let start = 0; start < deviceIds.length; start += 100) {
    const { data } = await supabase
      .from("defects")
      .select(
        "id, device_id, number, description, severity, question:checklist_template_items(label)",
      )
      .in("device_id", deviceIds.slice(start, start + 100))
      .neq("status", "resolved")
      .order("created_at");
    for (const defect of data ?? [])
      (defects[defect.device_id] ??= []).push({
        id: defect.id,
        number: defect.number,
        description: defect.description,
        severity: defect.severity,
        question: defect.question?.label ?? null,
      });
  }

  const paths = photos.map((photo) => photo.storage_path);
  const signed: string[] = [];
  for (let start = 0; start < paths.length; start += 100) {
    const { data } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .createSignedUrls(paths.slice(start, start + 100), SIGNED_URL_SECONDS);
    for (const entry of data ?? []) signed.push(entry.signedUrl ?? "");
  }

  const answersByItem = new Map<string, Record<string, AnswerDraft>>();
  for (const row of answers) {
    const record = answersByItem.get(row.item_id) ?? {};
    record[row.template_item_id] = {
      pass: row.value_pass,
      number:
        row.value_number === null
          ? ""
          : locale === "cs"
            ? String(row.value_number).replace(".", ",")
            : String(row.value_number),
      text: row.value_text ?? "",
      note: row.note ?? "",
      severity: row.defect_severity,
    };
    answersByItem.set(row.item_id, record);
  }
  const holdLimit = Date.now() - HOLD_MINUTES * 60_000;
  const itemsByDevice: Record<string, FieldItem> = {};
  for (const item of items) {
    const held =
      item.editing_by &&
      item.editing_by !== member.userId &&
      item.editing_at &&
      Date.parse(item.editing_at) > holdLimit;
    itemsByDevice[item.device_id] = {
      id: item.id,
      templateId: item.template_id ?? "",
      outcome: item.outcome,
      skipReason: item.skip_reason,
      notes: item.notes ?? "",
      heldBy: held ? (names.get(item.editing_by!) ?? "?") : null,
      checkedBy: item.checked_by ? (names.get(item.checked_by) ?? null) : null,
      checkedById: item.checked_by,
      checkedAt: item.checked_at,
      answers: answersByItem.get(item.id) ?? {},
      photos: photos
        .map((photo, index) => ({ photo, url: signed[index] ?? "" }))
        .filter(({ photo }) => photo.item_id === item.id)
        .map(({ photo, url }) => ({
          id: photo.id,
          questionId: photo.template_item_id,
          path: photo.storage_path,
          url,
        })),
    };
  }

  const ordered = devices.sort(
    (a, b) =>
      (a.location?.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.location?.sort_order ?? Number.MAX_SAFE_INTEGER) || a.label_number - b.label_number,
  );

  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    userId: member.userId,
    userName: names.get(member.userId) ?? "",
    organizationId: inspection.organization_id,
    inspection: {
      id: inspection.id,
      status: inspection.status,
      siteId,
      siteName: inspection.site?.name ?? "",
      customerId: inspection.site?.customer?.id ?? null,
      customerName: inspection.site?.customer?.name ?? null,
      accessNotes: inspection.site?.access_notes ?? null,
      // A correction can't be cancelled: that would delete the completed original.
      canCancel:
        inspection.status === "in_progress" &&
        inspection.reopened_at === null &&
        (inspection.started_by === member.userId || isManager(member.role)),
      correction: inspection.reopened_at !== null,
    },
    devices: ordered.map((device) => ({
      id: device.id,
      number: formatLabel(device.label_number),
      labelNumber: device.label_number,
      token: device.public_token,
      typeId: device.device_type_id,
      typeName: device.type?.name ?? "",
      locationName: device.location?.name ?? null,
      serialNumber: device.serial_number,
      lastInspectionOn: device.last_inspection_on,
    })),
    items: itemsByDevice,
    templates,
    activeTemplates,
    defects,
    plans: plans.flatMap((plan) =>
      plan.imageUrl
        ? [
            {
              id: plan.id,
              name: plan.name,
              width: plan.width,
              height: plan.height,
              imagePath: plan.imagePath,
              imageUrl: plan.imageUrl,
            },
          ]
        : [],
    ),
    placements,
    types: (types.data ?? []).map((type) => ({
      id: type.id,
      name: type.name,
      code: type.code,
      customFields: deviceTypeFields(type.custom_fields),
    })),
    locations: locations.data ?? [],
  };
}
