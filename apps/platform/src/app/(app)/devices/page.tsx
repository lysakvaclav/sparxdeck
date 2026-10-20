import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  AddIcon,
  DuplicateIcon,
  ExportIcon,
  OfficeIcon,
  PrintIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { deviceListQuery, deviceListSearch, readDeviceListParams } from "@/lib/device-list";
import { formatLabel } from "@/lib/devices";
import { dueState, todayInTimeZone } from "@/lib/due";
import { pageParam } from "@/lib/search";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { DeviceFilters } from "./device-filters";
import { DeviceListTable, type DeviceRow } from "./device-list-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("devices");
  return { title: t("title") };
}

const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DevicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("devices");
  const tCommon = await getTranslations("common");
  const tLabels = await getTranslations("labels");
  const tImport = await getTranslations("import");
  const manager = isManager(membership.role);

  const params = await searchParams;
  const list = readDeviceListParams(params);
  const { q, sort, filters } = list;
  const page = pageParam(params.page);

  const today = todayInTimeZone(organization.timezone);
  const soonDays = organization.due_soon_days;
  const supabase = await createClient();
  const org = organization.id;
  const query = deviceListQuery(supabase, org, list, { today, soonDays }, { count: "exact" });

  const from = (page - 1) * PAGE_SIZE;
  const [result, customers, sites, locations, types] = await Promise.all([
    query.order("id").range(from, from + PAGE_SIZE - 1),
    fetchAll((start, end) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      supabase
        .from("sites")
        .select("id, name, customer_id")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(start, end),
    ),
    filters.site
      ? supabase
          .from("locations")
          .select("id, name")
          .eq("site_id", filters.site)
          .order("sort_order")
          .order("created_at")
      : null,
    supabase
      .from("device_types")
      .select("id, name")
      .eq("organization_id", org)
      .eq("active", true)
      .order("name"),
  ]);
  const { data: devices, count, error } = result;

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listParams: Record<string, string | undefined> = {
    q: q || undefined,
    sort: sort === "label" ? undefined : sort,
    ...filters,
  };
  // A page past the end (e.g. after a filter change): go to the last one.
  if ((error || !devices?.length) && page > 1) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(listParams)) if (value) search.set(key, value);
    if (pages > 1) search.set("page", String(pages));
    redirect(`/devices?${search.toString()}`);
  }

  const filtered = Boolean(q) || Object.values(filters).some(Boolean);
  const nothingYet = total === 0 && !filtered;
  const noSites = sites.length === 0;

  const siteParam = filters.site ? `?site=${filters.site}` : "";
  const printButton = total > 0 && (
    <Button asChild variant="outline">
      <Link href={`/devices/labels${siteParam}`}>
        <PrintIcon />
        {tLabels("print")}
      </Link>
    </Button>
  );
  // The list as it is (search, filters, order) as a spreadsheet.
  const exportSearch = deviceListSearch(list);
  const exportButton = total > 0 && (
    <Button asChild variant="outline">
      <a href={`/devices/export${exportSearch ? `?${exportSearch}` : ""}`} download>
        <ExportIcon />
        {tCommon("exportCsv")}
      </a>
    </Button>
  );
  const addButtons = manager && !noSites && (
    <>
      <Button asChild variant="outline">
        <Link href="/import">
          <UploadIcon />
          {tImport("action")}
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/devices/bulk${siteParam}`}>
          <DuplicateIcon />
          {t("bulk")}
        </Link>
      </Button>
      <Button asChild>
        <Link href={`/devices/new${siteParam}`}>
          <AddIcon />
          {t("new")}
        </Link>
      </Button>
    </>
  );

  const app = appIcon("devices");
  const DeviceIcon = OBJECT_TYPES.device.icon;

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          (printButton || exportButton || addButtons) && (
            <>
              {printButton}
              {exportButton}
              {addButtons}
            </>
          )
        }
      />
      <PageBody>
        <Card>
          {nothingYet ? (
            noSites ? (
              <EmptyState
                icon={OfficeIcon}
                title={t("needSiteTitle")}
                description={manager ? t("needSiteBody") : t("emptyBodyReadOnly")}
                action={
                  manager && (
                    <Button asChild variant="outline">
                      <Link href="/customers">{t("needSiteAction")}</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <EmptyState
                icon={DeviceIcon}
                title={t("emptyTitle")}
                description={manager ? t("emptyBody") : t("emptyBodyReadOnly")}
                action={addButtons && <div className="flex gap-2">{addButtons}</div>}
              />
            )
          ) : (
            <>
              <div className="space-y-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <SearchInput placeholder={t("searchPlaceholder")} />
                  <p className="text-ui-sm text-muted-foreground" aria-live="polite">
                    {tCommon("results", { count: total })}
                  </p>
                </div>
                <DeviceFilters
                  values={filters}
                  customers={customers}
                  sites={sites.map((site) => ({
                    id: site.id,
                    name: site.name,
                    customerId: site.customer_id,
                  }))}
                  locations={locations?.data ?? null}
                  types={types.data ?? []}
                />
              </div>

              {devices && devices.length > 0 ? (
                <DeviceListTable
                  devices={devices.map((device): DeviceRow => ({
                    id: device.id,
                    label: formatLabel(device.label_number),
                    typeName: device.type?.name ?? null,
                    siteId: device.site.id,
                    siteName: device.site.name,
                    customerName: device.site.customer?.name ?? null,
                    locationName: device.location?.name ?? null,
                    serialNumber: device.serial_number,
                    status: device.status,
                    nextDue: device.next_due_on,
                    dueState: dueState(device.next_due_on, today, soonDays),
                  }))}
                  listParams={listParams}
                  sort={sort}
                  siteLocations={filters.site ? (locations?.data ?? []) : null}
                  manager={manager}
                />
              ) : (
                <EmptyState
                  icon={SearchIcon}
                  title={t("noResultsTitle")}
                  description={t("noResultsBody")}
                />
              )}

              <Pagination pathname="/devices" params={listParams} page={page} pages={pages} />
            </>
          )}
        </Card>
      </PageBody>
    </>
  );
}
