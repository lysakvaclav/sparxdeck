import "server-only";
import { gridRange, planState, type PlanState, type WorkloadPlan } from "@/lib/calendar";
import type { IsoDate } from "@/lib/due";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export type CalendarPlan = {
  id: string;
  siteId: string;
  siteName: string;
  customerName: string;
  plannedOn: IsoDate;
  technicianId: string | null;
  note: string | null;
  inspectionId: string | null;
  state: PlanState;
};

export type DueSite = { siteId: string; siteName: string; customerName: string; devices: number };

export type CalendarFilters = { customer?: string; technician?: string };

const PLAN_SELECT =
  "id, site_id, planned_on, technician_id, note, inspection_id, inspection:inspections(status), site:sites!inner(name, customer_id, customer:customers(name))";

type PlanRow = {
  id: string;
  site_id: string;
  planned_on: string;
  technician_id: string | null;
  note: string | null;
  inspection_id: string | null;
  inspection: { status: "in_progress" | "completed" } | null;
  site: { name: string; customer_id: string; customer: { name: string } | null };
};

function toPlan(row: PlanRow, today: IsoDate): CalendarPlan {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site.name,
    customerName: row.site.customer?.name ?? "",
    plannedOn: row.planned_on,
    technicianId: row.technician_id,
    note: row.note,
    inspectionId: row.inspection_id,
    state: planState(row.planned_on, row.inspection?.status ?? null, today),
  };
}

/**
 * One month of the calendar (the grid's neighbouring days included): planned
 * visits, active devices coming due per day and building, and what is overdue.
 */
export async function loadCalendarMonth(
  organizationId: string,
  month: string,
  today: IsoDate,
  filters: CalendarFilters,
) {
  const supabase = await createClient();
  const { from, to } = gridRange(month);

  const plans = await fetchAll((start, end) => {
    let query = supabase
      .from("inspection_plans")
      .select(PLAN_SELECT)
      .eq("organization_id", organizationId)
      .gte("planned_on", from)
      .lte("planned_on", to);
    if (filters.customer) query = query.eq("site.customer_id", filters.customer);
    if (filters.technician === "none") query = query.is("technician_id", null);
    else if (filters.technician) query = query.eq("technician_id", filters.technician);
    return query.order("planned_on").order("created_at").order("id").range(start, end);
  });

  const dueDevices = await fetchAll((start, end) => {
    let query = supabase
      .from("devices")
      .select("next_due_on, site_id, site:sites!inner(name, customer_id, customer:customers(name))")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("next_due_on", from)
      .lte("next_due_on", to);
    if (filters.customer) query = query.eq("site.customer_id", filters.customer);
    return query.order("id").range(start, end);
  });

  let overdueQuery = supabase
    .from("devices")
    .select("id, site:sites!inner(customer_id)", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .lt("next_due_on", today);
  if (filters.customer) overdueQuery = overdueQuery.eq("site.customer_id", filters.customer);
  const { count: overdue } = await overdueQuery;

  const due: Record<IsoDate, DueSite[]> = {};
  for (const device of dueDevices) {
    if (!device.next_due_on) continue;
    const day = (due[device.next_due_on] ??= []);
    const entry = day.find((site) => site.siteId === device.site_id);
    if (entry) entry.devices += 1;
    else
      day.push({
        siteId: device.site_id,
        siteName: device.site.name,
        customerName: device.site.customer?.name ?? "",
        devices: 1,
      });
  }
  for (const list of Object.values(due)) list.sort((a, b) => b.devices - a.devices);

  return {
    plans: (plans as PlanRow[]).map((row) => toPlan(row, today)),
    due,
    overdue: overdue ?? 0,
  };
}

/** Visits from `from` (inclusive) to `to` (exclusive) and the active devices of their buildings. */
export async function loadWorkload(organizationId: string, from: IsoDate, to: IsoDate) {
  const supabase = await createClient();
  const plans = await fetchAll((start, end) =>
    supabase
      .from("inspection_plans")
      .select("site_id, planned_on, technician_id")
      .eq("organization_id", organizationId)
      .gte("planned_on", from)
      .lt("planned_on", to)
      .order("id")
      .range(start, end),
  );
  const siteIds = [...new Set(plans.map((plan) => plan.site_id))];
  const devicesBySite: Record<string, number> = {};
  for (let index = 0; index < siteIds.length; index += 100) {
    const batch = siteIds.slice(index, index + 100);
    const rows = await fetchAll((start, end) =>
      supabase
        .from("devices")
        .select("site_id")
        .in("site_id", batch)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("id")
        .range(start, end),
    );
    for (const row of rows) devicesBySite[row.site_id] = (devicesBySite[row.site_id] ?? 0) + 1;
  }
  const workloadPlans: WorkloadPlan[] = plans.map((plan) => ({
    siteId: plan.site_id,
    plannedOn: plan.planned_on,
    technicianId: plan.technician_id,
  }));
  return { plans: workloadPlans, devicesBySite };
}

/** Upcoming visits of one building or one technician (for a building's page and the dashboard). */
export async function loadUpcomingPlans(
  organizationId: string,
  today: IsoDate,
  scope: { site?: string; technician?: string },
  limit = 5,
): Promise<CalendarPlan[]> {
  const supabase = await createClient();
  let query = supabase
    .from("inspection_plans")
    .select(PLAN_SELECT)
    .eq("organization_id", organizationId)
    .gte("planned_on", today)
    .is("inspection_id", null);
  if (scope.site) query = query.eq("site_id", scope.site);
  if (scope.technician) query = query.eq("technician_id", scope.technician);
  const { data } = await query.order("planned_on").order("created_at").limit(limit);
  return ((data ?? []) as PlanRow[]).map((row) => toPlan(row, today));
}
