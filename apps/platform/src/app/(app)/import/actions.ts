"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { databaseErrorCode, type ActionResult } from "@/lib/errors";
import type { DeviceTypeOption, ExistingData } from "@/lib/import";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema, importSchema, type ImportRecord } from "@/lib/validation";

// Import from Excel or CSV (owners and admins). The browser reads the file and
// checks the rows; here they're checked again and imported in one transaction.

export type ImportContext = ExistingData & { types: DeviceTypeOption[] };

/** What the preview compares the file with: the company's customers, buildings and types. */
export async function importContext(): Promise<ActionResult<ImportContext>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const organizationId = active.organization.id;
  const [customers, sites, locations, devices, { data: types }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name, company_id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("sites")
        .select("id, customer_id, name")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("locations")
        .select("site_id, name")
        .eq("organization_id", organizationId)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("devices")
        .select("site_id, serial_number")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .not("serial_number", "is", null)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("device_types")
      .select("id, name, code")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at"),
  ]);
  return {
    ok: true,
    data: {
      customers: customers.map((row) => ({
        id: row.id,
        name: row.name,
        companyId: row.company_id,
      })),
      sites: sites.map((row) => ({ id: row.id, customerId: row.customer_id, name: row.name })),
      locations: locations.map((row) => ({ siteId: row.site_id, name: row.name })),
      serials: devices.map((row) => ({ siteId: row.site_id, serial: row.serial_number ?? "" })),
      types: types ?? [],
    },
  };
}

/** A checked record as import_records takes it. */
function databaseRow(record: ImportRecord) {
  const device = record.device;
  return {
    customer: {
      name: record.customer.name,
      company_id: record.customer.companyId,
      contact_person: record.customer.contactPerson,
      email: record.customer.email,
      phone: record.customer.phone,
      billing_address: record.customer.billingAddress,
    },
    site: {
      name: record.site.name,
      address: record.site.address,
      access_notes: record.site.accessNotes,
    },
    location: record.location,
    device: device && {
      device_type_id: device.deviceTypeId,
      serial_number: device.serialNumber,
      manufacturer: device.manufacturer,
      model: device.model,
      manufacture_year: device.manufactureYear,
      installed_on: device.installedOn,
      last_inspection_on: device.lastInspectionOn,
      notes: device.notes,
      attributes: Object.fromEntries(
        Object.entries({ agent: device.agent, size: device.size }).filter(([, value]) => value),
      ),
    },
  };
}

export type ImportResult = {
  importId: string;
  customers: number;
  sites: number;
  locations: number;
  devices: number;
  skipped: number;
  buildings: { id: string; name: string; customerName: string; devices: number }[];
};

export async function runImport(input: unknown): Promise<ActionResult<ImportResult>> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues.find((issue) => issue.path.length === 1)?.message;
    return {
      ok: false,
      error: code === "importTooLarge" || code === "importEmpty" ? code : "importInvalid",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_records", {
    p_org: active.organization.id,
    p_file_name: parsed.data.fileName,
    p_rows: parsed.data.records.map(databaseRow),
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return { ok: false, error: error ? databaseErrorCode(error) : "unexpected" };
  const result = data as {
    import_id: string;
    customers: number;
    sites: number;
    locations: number;
    devices: number;
    skipped: number;
    site_ids: string[];
  };

  // The buildings it touched, with how many devices it added to each.
  const [{ data: sites }, { data: added }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, customer:customers(name)")
      .in("id", result.site_ids.slice(0, 200)),
    supabase.from("devices").select("site_id").eq("import_id", result.import_id).limit(10000),
  ]);
  const counts = new Map<string, number>();
  for (const row of added ?? []) counts.set(row.site_id, (counts.get(row.site_id) ?? 0) + 1);
  const order = new Map(result.site_ids.map((id, index) => [id, index]));

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: {
      importId: result.import_id,
      customers: result.customers,
      sites: result.sites,
      locations: result.locations,
      devices: result.devices,
      skipped: result.skipped,
      buildings: (sites ?? [])
        .map((site) => ({
          id: site.id,
          name: site.name,
          customerName: site.customer?.name ?? "",
          devices: counts.get(site.id) ?? 0,
        }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    },
  };
}

/** Removes what an import created, while nobody has worked with it. */
export async function undoImport(importId: string): Promise<ActionResult> {
  const active = await requireManager();
  if (!active) return { ok: false, error: "forbidden" };
  if (!idSchema.safeParse(importId).success) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_import", { p_import: importId });
  if (error) return { ok: false, error: databaseErrorCode(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
