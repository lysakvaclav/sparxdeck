import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { memberNames } from "@/lib/inspection-data";
import { readMapFilters } from "@/lib/site-map";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { MapWorkspace } from "./map-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("siteMap");
  return { title: t("title") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The map of buildings (part 21). The database computes each building's state
 * (site_map_statuses, Row Level Security as everywhere); the page only passes
 * the filters from the address and the options for them.
 */
export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("siteMap");
  const filters = readMapFilters(await searchParams);
  const supabase = await createClient();

  const [statuses, customers, types, names] = await Promise.all([
    supabase.rpc("site_map_statuses", {
      p_customer: filters.customer ?? null,
      p_device_type: filters.type ?? null,
      p_technician: filters.technician ?? null,
    }),
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("device_types")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name"),
    memberNames(organization.id),
  ]);
  const collator = new Intl.Collator(await getLocale());
  const technicians = [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => collator.compare(a.name, b.name));
  const app = appIcon("map");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
      />
      <MapWorkspace
        organizationId={organization.id}
        rows={statuses.data ?? []}
        filters={filters}
        customers={customers}
        types={types.data ?? []}
        technicians={technicians}
        manager={isManager(membership.role)}
      />
    </>
  );
}
