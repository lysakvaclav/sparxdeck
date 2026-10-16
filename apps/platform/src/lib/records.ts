import "server-only";
import { cache } from "react";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

// Loaders for detail pages. RLS limits them to the user's organization; deleted
// records count as missing. Cached per request (metadata and page share a query).

export const getCustomer = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export const getSite = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("*, customer:customers(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export const getDeviceType = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("device_types").select("*").eq("id", id).maybeSingle();
  return data;
});

export const getDevice = cache(async (id: string) => {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select(
      "*, site:sites(id, name, customer:customers(id, name)), location:locations(id, name), type:device_types(id, code, name, inspection_interval_months)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
});

export type SiteOption = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  locations: { id: string; name: string }[];
};

export type DeviceTypeOption = {
  id: string;
  code: string;
  name: string;
  intervalMonths: number;
};

const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });

/** Buildings (with their locations in route order) and device types for device forms. */
export const getDeviceFormOptions = cache(async (organizationId: string) => {
  const supabase = await createClient();
  const [sites, types] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("sites")
        .select("id, name, customer:customers(id, name), locations(id, name, sort_order)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("device_types")
      .select("id, code, name, inspection_interval_months")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
  ]);

  const siteOptions: SiteOption[] = sites
    .map((site) => ({
      id: site.id,
      name: site.name,
      customerId: site.customer?.id ?? "",
      customerName: site.customer?.name ?? "",
      locations: [...site.locations]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ id, name }) => ({ id, name })),
    }))
    .sort(
      (a, b) =>
        collator.compare(a.customerName, b.customerName) || collator.compare(a.name, b.name),
    );
  const typeOptions: DeviceTypeOption[] = (types.data ?? []).map((type) => ({
    id: type.id,
    code: type.code,
    name: type.name,
    intervalMonths: type.inspection_interval_months,
  }));
  return { sites: siteOptions, types: typeOptions };
});
