import "server-only";
import { addDays, isIsoDate, startOfDayInTimeZone, todayInTimeZone } from "@/lib/due";
import { protocolNumber } from "@/lib/protocol";
import type { SummaryBuilding } from "@/lib/protocol-summary";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

export type SummaryFilters = {
  organizationId: string;
  /** The company's time zone: the period's days are its days. */
  timeZone: string;
  /** A specific building, or every building of this customer, or all of them. */
  customerId?: string;
  siteId?: string;
  from: string;
  to: string;
};

/**
 * The report's filters from the URL (page and PDF read the same): ids that
 * aren't ids are ignored, the period defaults to the last year and is put in
 * order if given backwards.
 */
export function readSummaryFilters(
  get: (key: string) => string | undefined,
  organization: { id: string; timezone: string },
): SummaryFilters {
  const id = (value: string | undefined) =>
    value && idSchema.safeParse(value).success ? value : undefined;
  const date = (value: string | undefined) => (value && isIsoDate(value) ? value : undefined);
  const today = todayInTimeZone(organization.timezone);
  const from = date(get("from")) ?? addDays(today, -365);
  const to = date(get("to")) ?? today;
  return {
    organizationId: organization.id,
    timeZone: organization.timezone,
    customerId: id(get("customer")),
    siteId: id(get("site")),
    from: from <= to ? from : to,
    to: from <= to ? to : from,
  };
}

export type SummaryData = {
  organization: { name: string; legalName: string | null; timezone: string; locale: "cs" | "en" };
  customerName: string | null;
  siteName: string | null;
  buildings: SummaryBuilding[];
};

/**
 * Completed inspections and currently open defects, grouped by building.
 * Shared by the on-page preview and the PDF route, so both agree.
 */
export async function loadSummaryData(filters: SummaryFilters): Promise<SummaryData> {
  const supabase = await createClient();
  const [{ data: organization }, { data: scopedCustomer }, { data: scopedSite }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, legal_name, timezone, default_locale")
        .eq("id", filters.organizationId)
        .single(),
      filters.customerId
        ? supabase.from("customers").select("name").eq("id", filters.customerId).maybeSingle()
        : Promise.resolve({ data: null }),
      filters.siteId
        ? supabase.from("sites").select("name").eq("id", filters.siteId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  let sitesQuery = supabase
    .from("sites")
    .select("id, name, customer:customers(name)")
    .eq("organization_id", filters.organizationId)
    .is("deleted_at", null);
  if (filters.siteId) sitesQuery = sitesQuery.eq("id", filters.siteId);
  else if (filters.customerId) sitesQuery = sitesQuery.eq("customer_id", filters.customerId);
  const { data: sites } = await sitesQuery;
  const siteIds = (sites ?? []).map((site) => site.id);

  if (siteIds.length === 0) {
    return {
      organization: {
        name: organization?.name ?? "",
        legalName: organization?.legal_name ?? null,
        timezone: organization?.timezone ?? "UTC",
        locale: organization?.default_locale === "en" ? "en" : "cs",
      },
      customerName: scopedCustomer?.name ?? null,
      siteName: scopedSite?.name ?? null,
      buildings: [],
    };
  }

  const [inspections, defects] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("inspections")
        .select("id, site_id, completed_at, protocol:protocols(year, number, number_format, active)")
        .in("site_id", siteIds)
        .eq("status", "completed")
        .gte("completed_at", startOfDayInTimeZone(filters.from, filters.timeZone).toISOString())
        .lt(
          "completed_at",
          startOfDayInTimeZone(addDays(filters.to, 1), filters.timeZone).toISOString(),
        )
        .order("completed_at")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("defects")
        .select(
          "number, description, severity, created_at, device:devices!inner(label_number, site_id)",
        )
        .in("device.site_id", siteIds)
        .neq("status", "resolved")
        .order("number")
        .range(from, to),
    ),
  ]);
  const inspectionIds = inspections.map((inspection) => inspection.id);
  const items =
    inspectionIds.length > 0
      ? await fetchAll((from, to) =>
          supabase
            .from("inspection_items")
            .select("inspection_id, outcome")
            .in("inspection_id", inspectionIds)
            .range(from, to),
        )
      : [];

  const bySite = new Map<string, SummaryBuilding>();
  for (const site of sites ?? []) {
    bySite.set(site.id, {
      siteName: site.name,
      customerName: site.customer?.name ?? null,
      inspections: [],
      openDefects: [],
    });
  }

  const outcomesByInspection = new Map<string, { passed: number; failed: number; notChecked: number }>();
  for (const item of items) {
    const counts = outcomesByInspection.get(item.inspection_id) ?? {
      passed: 0,
      failed: 0,
      notChecked: 0,
    };
    if (item.outcome === "passed") counts.passed += 1;
    else if (item.outcome === "failed") counts.failed += 1;
    else if (item.outcome === "not_checked") counts.notChecked += 1;
    outcomesByInspection.set(item.inspection_id, counts);
  }
  for (const inspection of inspections) {
    const building = bySite.get(inspection.site_id);
    if (!building || !inspection.completed_at) continue;
    const protocol = inspection.protocol?.find((entry) => entry.active) ?? null;
    const counts = outcomesByInspection.get(inspection.id) ?? {
      passed: 0,
      failed: 0,
      notChecked: 0,
    };
    building.inspections.push({
      date: inspection.completed_at,
      protocolNumber: protocol
        ? protocolNumber(protocol.year, protocol.number, protocol.number_format)
        : null,
      ...counts,
    });
  }
  for (const defect of defects) {
    const siteId = defect.device?.site_id;
    const building = siteId ? bySite.get(siteId) : undefined;
    if (!building) continue;
    building.openDefects.push({
      number: defect.number,
      labelNumber: defect.device?.label_number ?? 0,
      description: defect.description,
      severity: defect.severity,
      openSince: defect.created_at,
    });
  }

  // A building with nothing to show is dropped, unless it was chosen by name.
  const buildings = [...bySite.values()].filter(
    (building) =>
      filters.siteId !== undefined ||
      building.inspections.length > 0 ||
      building.openDefects.length > 0,
  );

  return {
    organization: {
      name: organization?.name ?? "",
      legalName: organization?.legal_name ?? null,
      timezone: organization?.timezone ?? "UTC",
      locale: organization?.default_locale === "en" ? "en" : "cs",
    },
    customerName: scopedCustomer?.name ?? null,
    siteName: scopedSite?.name ?? null,
    buildings,
  };
}
