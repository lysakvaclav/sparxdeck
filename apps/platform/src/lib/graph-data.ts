import "server-only";
import { todayInTimeZone } from "@/lib/due";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import type { GraphData } from "@/lib/graph";

/** Everything the connection map shows for one organization (RLS limits it to members). */
export async function loadGraphData(organization: {
  id: string;
  timezone: string;
  due_soon_days: number;
}): Promise<GraphData> {
  const organizationId = organization.id;
  const supabase = await createClient();
  const [customers, sites, locations, devices] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select(
          "id, name, company_id, vat_id, contact_person, email, phone, billing_address, notes, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("sites")
        .select("id, customer_id, name, address, access_notes, notes, created_at, updated_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("locations")
        .select("id, site_id, name, sort_order, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("devices")
        .select(
          "id, site_id, location_id, label_number, serial_number, status, next_due_on, last_inspection_on, created_at, updated_at, type:device_types(name)",
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      companyId: c.company_id,
      vatId: c.vat_id,
      contactPerson: c.contact_person,
      email: c.email,
      phone: c.phone,
      billingAddress: c.billing_address,
      notes: c.notes,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    sites: sites.map((s) => ({
      id: s.id,
      customerId: s.customer_id,
      name: s.name,
      address: s.address,
      accessNotes: s.access_notes,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    // Locations of deleted sites drop out when the graph is built (no parent).
    locations: locations.map((l) => ({
      id: l.id,
      siteId: l.site_id,
      name: l.name,
      sortOrder: l.sort_order,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })),
    devices: devices.map((d) => ({
      id: d.id,
      siteId: d.site_id,
      locationId: d.location_id,
      labelNumber: d.label_number,
      typeName: d.type?.name ?? "",
      serialNumber: d.serial_number,
      status: d.status,
      nextDueOn: d.next_due_on,
      lastInspectionOn: d.last_inspection_on,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
    due: {
      today: todayInTimeZone(organization.timezone),
      soonDays: organization.due_soon_days,
    },
  };
}
