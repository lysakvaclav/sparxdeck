import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AddIcon, SearchIcon } from "@/components/icons";
import { DefectRef, DefectStatusBadge, SeverityBadge } from "@/components/app/defect-badges";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { SearchInput } from "@/components/app/search-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  RowLink,
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth";
import { DEFECT_SEVERITIES, DEFECT_STATUSES } from "@/lib/defects";
import { formatLabel, labelQuery } from "@/lib/devices";
import { ilikeAny, pageParam } from "@/lib/search";
import type { DefectSeverity, DefectStatus } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import { DefectFilters, type DefectFilterValues } from "./defect-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("defects");
  return { title: t("title") };
}

const PAGE_SIZE = 50;
const SORTS = ["newest", "severity"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
const validId = (value: string | undefined) =>
  value && idSchema.safeParse(value).success ? value : undefined;
function oneOf<T extends string>(options: readonly T[], value: string | undefined) {
  return options.includes(value as T) ? (value as T) : undefined;
}

/** Defects across the company: unresolved ones by default, most recent first. */
export default async function DefectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { organization } = await requireMembership();
  const t = await getTranslations("defects");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) ?? "";
  const sort: Sort = oneOf(SORTS, first(params.sort)) ?? "newest";
  const page = pageParam(params.page);
  const status = first(params.status);
  const filters: DefectFilterValues = {
    status: status === "all" ? "all" : (oneOf(DEFECT_STATUSES, status) ?? undefined),
    severity: oneOf(DEFECT_SEVERITIES, first(params.severity)),
    customer: validId(first(params.customer)),
    site: validId(first(params.site)),
  };

  const supabase = await createClient();
  const org = organization.id;
  let query = supabase
    .from("defects")
    .select(
      "id, number, description, severity, status, created_at, device:devices!inner(id, label_number, site_id, type:device_types(name), site:sites!inner(id, name, customer_id))",
      { count: "exact" },
    )
    .eq("organization_id", org);
  // Unresolved (open + in progress) unless a status or "all" is chosen.
  if (!filters.status) query = query.neq("status", "resolved");
  else if (filters.status !== "all") query = query.eq("status", filters.status as DefectStatus);
  if (filters.severity) query = query.eq("severity", filters.severity as DefectSeverity);
  if (filters.site) query = query.eq("device.site_id", filters.site);
  if (filters.customer) query = query.eq("device.site.customer_id", filters.customer);
  const label = labelQuery(q);
  if (label) query = query.eq("device.label_number", label);
  else {
    const search = ilikeAny(["description"], q);
    if (search) query = query.or(search);
  }
  query =
    sort === "severity"
      ? query.order("severity", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const [result, customers, sites] = await Promise.all([
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
  ]);
  const { data: defects, count, error } = result;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listParams: Record<string, string | undefined> = {
    q: q || undefined,
    sort: sort === "newest" ? undefined : sort,
    ...filters,
  };
  if ((error || !defects?.length) && page > 1) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(listParams)) if (value) search.set(key, value);
    if (pages > 1) search.set("page", String(pages));
    redirect(`/defects?${search.toString()}`);
  }
  const sortHref = (value: Sort) => {
    const search = new URLSearchParams();
    for (const [key, entry] of Object.entries({
      ...listParams,
      sort: value === "newest" ? undefined : value,
    }))
      if (entry) search.set(key, entry);
    const target = search.toString();
    return target ? `/defects?${target}` : "/defects";
  };

  const app = appIcon("defects");
  const newButton = (
    <Button asChild>
      <Link href="/defects/new">
        <AddIcon />
        {t("new")}
      </Link>
    </Button>
  );
  const filtered = Boolean(q) || Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={newButton}
      />
      <PageBody>
        <Card>
          <div className="space-y-2 px-3 py-3 sm:px-4 shadow-[inset_0_-1px_0_var(--border)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput placeholder={t("searchPlaceholder")} />
              <p className="text-ui-sm text-muted-foreground" aria-live="polite">
                {tCommon("results", { count: total })}
              </p>
            </div>
            <DefectFilters
              values={filters}
              customers={customers}
              sites={sites.map((site) => ({
                id: site.id,
                name: site.name,
                customerId: site.customer_id,
              }))}
            />
          </div>

          {defects && defects.length > 0 ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="w-24">{t("columns.number")}</TableHeaderCell>
                  <TableHeaderCell className="md:w-[45%]">
                    {t("columns.description")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">
                    {t("columns.device")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden lg:table-cell lg:w-[18%]">
                    {t("columns.site")}
                  </TableHeaderCell>
                  <SortableHeader
                    href={sortHref("severity")}
                    active={sort === "severity"}
                    direction="desc"
                    className="hidden sm:table-cell"
                  >
                    {t("columns.severity")}
                  </SortableHeader>
                  <TableHeaderCell className="hidden sm:table-cell">
                    {t("columns.status")}
                  </TableHeaderCell>
                  <SortableHeader
                    href={sortHref("newest")}
                    active={sort === "newest"}
                    direction="desc"
                    className="hidden xl:table-cell"
                  >
                    {t("columns.created")}
                  </SortableHeader>
                </tr>
              </TableHead>
              <TableBody>
                {defects.map((defect) => (
                  <TableRow key={defect.id}>
                    <TableCell className="whitespace-nowrap">
                      <RowLink href={`/defects/${defect.id}`}>
                        <DefectRef number={defect.number} />
                      </RowLink>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="line-clamp-2 break-words">{defect.description}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                        <SeverityBadge severity={defect.severity} />
                        <DefectStatusBadge status={defect.status} />
                        <span className="text-ui-sm text-muted-foreground">
                          {formatLabel(defect.device.label_number)} · {defect.device.site.name}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      <Link
                        href={`/devices/${defect.device.id}`}
                        className="relative z-[1] font-mono tabular-nums hover:underline"
                      >
                        {formatLabel(defect.device.label_number)}
                      </Link>{" "}
                      <span className="text-muted-foreground">{defect.device.type?.name}</span>
                    </TableCell>
                    <TableCell className="hidden max-w-0 truncate lg:table-cell">
                      {defect.device.site.name}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      <SeverityBadge severity={defect.severity} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      <DefectStatusBadge status={defect.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                      {format.dateTime(new Date(defect.created_at), { dateStyle: "medium" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={filtered ? SearchIcon : app.icon}
              title={filtered ? t("noResultsTitle") : t("emptyTitle")}
              description={filtered ? t("noResultsBody") : t("emptyBody")}
            />
          )}
          <Pagination pathname="/defects" params={listParams} page={page} pages={pages} />
        </Card>
      </PageBody>
    </>
  );
}
