import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { csvFileName, csvSeparator, toCsv } from "@/lib/csv";
import { formatLabel } from "@/lib/devices";
import { todayInTimeZone } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { protocolNumber } from "@/lib/protocol";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Completed inspections as a CSV file: one row per device check, newest
 * inspection first, with the protocol number and the items that failed.
 */
export async function GET() {
  const active = await getActiveMembership();
  if (!active) return new NextResponse(null, { status: 404 });
  const { organization } = active;
  const locale = await getLocale();
  const t = await getTranslations("export");
  const tOutcome = await getTranslations("inspections.outcome");
  const supabase = await createClient();
  const org = organization.id;

  const [items, failedAnswers, names] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("inspection_items")
        .select(
          "id, outcome, checked_by, checked_at, notes, device:devices(label_number, type:device_types(name)), inspection:inspections!inner(id, status, completed_at, site:sites(name, customer:customers(name)), protocol:protocols(year, number))",
        )
        .eq("organization_id", org)
        .eq("inspection.status", "completed")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("inspection_answers")
        .select("id, item_id, question:checklist_template_items(label, sort_order)")
        .eq("organization_id", org)
        .eq("value_pass", false)
        .order("id")
        .range(from, to),
    ),
    memberNames(org),
  ]);

  const failedOf = new Map<string, { label: string; order: number }[]>();
  for (const answer of failedAnswers) {
    if (!answer.question) continue;
    const list = failedOf.get(answer.item_id) ?? [];
    list.push({ label: answer.question.label, order: answer.question.sort_order });
    failedOf.set(answer.item_id, list);
  }
  // Times in the company's time zone, sortable: "2026-10-13 15:42".
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: organization.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const time = (value: string | null) => (value ? stamp.format(new Date(value)) : null);

  items.sort(
    (a, b) =>
      (b.inspection.completed_at ?? "").localeCompare(a.inspection.completed_at ?? "") ||
      a.inspection.id.localeCompare(b.inspection.id) ||
      (a.device?.label_number ?? 0) - (b.device?.label_number ?? 0),
  );

  const header = [
    t("inspections.completed"),
    t("inspections.protocol"),
    t("inspections.customer"),
    t("inspections.site"),
    t("inspections.label"),
    t("inspections.type"),
    t("inspections.result"),
    t("inspections.checkedBy"),
    t("inspections.checkedAt"),
    t("inspections.failed"),
    t("inspections.note"),
  ];
  const rows = items.map((item) => {
    const protocol = item.inspection.protocol;
    return [
      time(item.inspection.completed_at),
      protocol ? protocolNumber(protocol.year, protocol.number) : null,
      item.inspection.site?.customer?.name,
      item.inspection.site?.name,
      item.device ? formatLabel(item.device.label_number) : null,
      item.device?.type?.name,
      item.outcome ? tOutcome(item.outcome) : null,
      item.checked_by ? (names.get(item.checked_by) ?? null) : null,
      time(item.checked_at),
      (failedOf.get(item.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .map((failed) => failed.label)
        .join(" | "),
      item.notes,
    ];
  });

  const today = todayInTimeZone(organization.timezone);
  const file = toCsv(header, rows, csvSeparator(locale));
  return new NextResponse(file, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(t("inspectionsFile"), today)}"`,
      "Cache-Control": "no-store",
    },
  });
}
