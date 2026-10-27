import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExportIcon, PanelTableIcon, PlayIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RowLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth";
import { protocolNumber } from "@/lib/protocol";
import { memberNames } from "@/lib/inspection-data";
import { pageParam } from "@/lib/search";
import { cn } from "@/lib/utils";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspections");
  return { title: t("title") };
}

const PAGE_SIZE = 20;

/** The current version among the inspection's protocols (there can be past ones too). */
function activeProtocol<T extends { active: boolean }>(protocols: T[] | null | undefined) {
  return protocols?.find((protocol) => protocol.active) ?? null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Inspections in progress (to continue) and completed ones (newest first).
 * ?location=mismatch keeps those where a scan's position didn't match the
 * building (for the office to look at).
 */
export default async function InspectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { organization } = await requireMembership();
  const t = await getTranslations("inspections");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const params = await searchParams;
  const page = pageParam(params.page);
  const mismatchOnly = params.location === "mismatch";
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();
  const select =
    "id, status, started_at, started_by, completed_at, completed_by, site:sites(id, name, customer:customers(name)), inspection_items(outcome, location_state), protocol:protocols(year, number, number_format, active)";
  // Inspections with a scan whose position didn't match (a small, indexed set).
  const mismatched = mismatchOnly
    ? [
        ...new Set(
          (
            await fetchAll((from, to) =>
              supabase
                .from("inspection_items")
                .select("inspection_id")
                .eq("organization_id", organization.id)
                .eq("location_state", "mismatch")
                .order("inspection_id")
                .range(from, to),
            )
          ).map((row) => row.inspection_id),
        ),
      ]
    : null;
  const inspections = (count?: "exact") => {
    const query = supabase
      .from("inspections")
      .select(select, count ? { count } : undefined)
      .eq("organization_id", organization.id);
    // An impossible id keeps the query valid when nothing matches.
    return mismatched
      ? query.in("id", mismatched.length ? mismatched : ["00000000-0000-0000-0000-000000000000"])
      : query;
  };
  const [open, done, names] = await Promise.all([
    inspections().eq("status", "in_progress").order("started_at", { ascending: false }),
    inspections("exact")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1),
    memberNames(organization.id),
  ]);
  const pages = Math.max(1, Math.ceil((done.count ?? 0) / PAGE_SIZE));
  const listParams: Record<string, string> = mismatchOnly ? { location: "mismatch" } : {};
  if (page > 1 && !done.data?.length)
    redirect(
      pages > 1
        ? `/inspections?${new URLSearchParams({ ...listParams, page: String(pages) }).toString()}`
        : `/inspections${mismatchOnly ? "?location=mismatch" : ""}`,
    );

  // Progress of open inspections: finished checks of the building's active devices.
  const openSites = (open.data ?? []).map((inspection) => inspection.site?.id ?? "");
  const { data: activeDevices } = openSites.length
    ? await supabase
        .from("devices")
        .select("site_id")
        .in("site_id", openSites)
        .is("deleted_at", null)
        .eq("status", "active")
    : { data: [] };
  const deviceCount = new Map<string, number>();
  for (const device of activeDevices ?? [])
    deviceCount.set(device.site_id, (deviceCount.get(device.site_id) ?? 0) + 1);

  const startButton = (
    <Button asChild>
      <Link href="/inspections/new">
        <PlayIcon />
        {t("start")}
      </Link>
    </Button>
  );
  const app = appIcon("inspections");
  const SiteIcon = OBJECT_TYPES.site.icon;
  const nothing = !mismatchOnly && !open.data?.length && !done.count;
  const mismatches = (items: { location_state: string | null }[]) =>
    items.filter((item) => item.location_state === "mismatch").length;
  const locationFilter = (
    <nav aria-label={t("locationFilter.label")} className="flex rounded-lg bg-canvas p-0.5">
      {(["all", "mismatch"] as const).map((value) => {
        const active = (value === "mismatch") === mismatchOnly;
        return (
          <Link
            key={value}
            href={value === "mismatch" ? "/inspections?location=mismatch" : "/inspections"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[26px] items-center rounded-[5px] px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
              active
                ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`locationFilter.${value}`)}
          </Link>
        );
      })}
    </nav>
  );
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/inspections/summary">
                <PanelTableIcon />
                {t("summary.title")}
              </Link>
            </Button>
            {!!done.count && (
              <Button asChild variant="outline">
                <a href="/inspections/export" download>
                  <ExportIcon />
                  {tCommon("exportCsv")}
                </a>
              </Button>
            )}
            {startButton}
          </>
        }
      />
      <PageBody>
        {nothing ? (
          <Card>
            <EmptyState
              icon={app.icon}
              title={t("emptyTitle")}
              description={t("emptyBody")}
              action={startButton}
            />
          </Card>
        ) : (
          <div className="space-y-2.5 sm:space-y-[15px]">
            {locationFilter}
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("inProgress")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({open.data?.length ?? 0})
                  </span>
                </CardTitle>
              </CardHeader>
              {open.data?.length ? (
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>{t("columns.site")}</TableHeaderCell>
                      <TableHeaderCell className="hidden md:table-cell">
                        {t("columns.customer")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden sm:table-cell">
                        {t("columns.startedBy")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden lg:table-cell">
                        {t("columns.startedAt")}
                      </TableHeaderCell>
                      <TableHeaderCell className="text-end">
                        {t("columns.progress")}
                      </TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {open.data.map((inspection) => {
                      const total = deviceCount.get(inspection.site?.id ?? "") ?? 0;
                      const finished = inspection.inspection_items.filter(
                        (item) => item.outcome !== null,
                      ).length;
                      return (
                        <TableRow key={inspection.id}>
                          <TableCell className="w-full max-w-0 sm:w-[32%]">
                            <span className="flex min-w-0 items-center gap-2">
                              <SiteIcon className={OBJECT_TYPES.site.text} />
                              <span className="min-w-0">
                                <RowLink
                                  href={`/inspections/${inspection.id}`}
                                  className="block truncate"
                                >
                                  {inspection.site?.name}
                                </RowLink>
                                <span className="block truncate text-ui-sm text-muted-foreground md:hidden">
                                  {inspection.site?.customer?.name}
                                </span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                            {inspection.site?.customer?.name}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap sm:table-cell">
                            {(inspection.started_by && names.get(inspection.started_by)) ?? "—"}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                            {time(inspection.started_at)}
                          </TableCell>
                          <TableCell className="text-end whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span
                                aria-hidden
                                className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[rgb(138_155_168/0.3)] sm:block"
                              >
                                <span
                                  className="block h-full bg-primary"
                                  style={{ width: `${total ? (finished / total) * 100 : 0}%` }}
                                />
                              </span>
                              <span className="tabular-nums">
                                {t("progress", { done: finished, total })}
                              </span>
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-[15px] py-3 text-ui text-muted-foreground">
                  {t("noneInProgress")}
                </p>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t("completed")}{" "}
                  <span className="font-normal text-muted-foreground">({done.count ?? 0})</span>
                </CardTitle>
              </CardHeader>
              {done.data?.length ? (
                <>
                  <Table>
                    <TableHead>
                      <tr>
                        <TableHeaderCell>{t("columns.site")}</TableHeaderCell>
                        <TableHeaderCell className="hidden md:table-cell">
                          {t("columns.customer")}
                        </TableHeaderCell>
                        <TableHeaderCell className="hidden sm:table-cell">
                          {t("columns.completedAt")}
                        </TableHeaderCell>
                        <TableHeaderCell className="hidden lg:table-cell">
                          {t("columns.protocol")}
                        </TableHeaderCell>
                        <TableHeaderCell className="text-end">
                          {t("columns.results")}
                        </TableHeaderCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {done.data.map((inspection) => {
                        const count = (outcome: string) =>
                          inspection.inspection_items.filter((item) => item.outcome === outcome)
                            .length;
                        const failed = count("failed");
                        const notChecked = count("not_checked");
                        const protocol = activeProtocol(inspection.protocol);
                        const number = protocol
                          ? protocolNumber(protocol.year, protocol.number, protocol.number_format)
                          : null;
                        return (
                          <TableRow key={inspection.id}>
                            <TableCell className="w-full max-w-0 sm:w-[36%]">
                              <span className="flex min-w-0 items-center gap-2">
                                <SiteIcon className={OBJECT_TYPES.site.text} />
                                <span className="min-w-0">
                                  <RowLink
                                    href={`/inspections/${inspection.id}`}
                                    className="block truncate"
                                  >
                                    {inspection.site?.name}
                                  </RowLink>
                                  <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                                    {inspection.completed_at && time(inspection.completed_at)}
                                    {number && ` · ${number}`}
                                  </span>
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                              {inspection.site?.customer?.name}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                              {inspection.completed_at && time(inspection.completed_at)}
                            </TableCell>
                            <TableCell className="hidden font-mono whitespace-nowrap tabular-nums lg:table-cell">
                              {number ?? "—"}
                            </TableCell>
                            <TableCell className="text-end">
                              <span className="inline-flex flex-wrap justify-end gap-1">
                                <Badge variant="success">
                                  {count("passed")} × {t("outcome.passed")}
                                </Badge>
                                {failed > 0 && (
                                  <Badge variant="danger">
                                    {failed} × {t("outcome.failed")}
                                  </Badge>
                                )}
                                {notChecked > 0 && (
                                  <Badge>
                                    {notChecked} × {t("outcome.not_checked")}
                                  </Badge>
                                )}
                                {mismatches(inspection.inspection_items) > 0 && (
                                  <Badge variant="outline">
                                    {t("locationFilter.count", {
                                      count: mismatches(inspection.inspection_items),
                                    })}
                                  </Badge>
                                )}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    pathname="/inspections"
                    params={listParams}
                    page={page}
                    pages={pages}
                  />
                </>
              ) : (
                <p className="px-[15px] py-3 text-ui text-muted-foreground">{t("noneCompleted")}</p>
              )}
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}
