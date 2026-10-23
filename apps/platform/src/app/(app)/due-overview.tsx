import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRightIcon } from "@/components/icons";
import { DUE_BADGE } from "@/components/app/device-badges";
import { Badge } from "@/components/ui/badge";
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
import { SEVERITY_BADGE } from "@/lib/defects";
import { CALENDAR_FORMAT, DUE_STATES, calendarDate, dueWindow, type DueState } from "@/lib/due";
import { HORIZONS, duePlan, horizonWindow, type Horizon } from "@/lib/due-plan";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Buildings listed in "coming due"; the rest are one click away in the device list. */
const SHOWN = 15;

export type OverviewScope = { customer?: string; site?: string };

/** "?a=1&b=2" from the values that are set. */
function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const search = params.toString();
  return search ? `?${search}` : "";
}

const rowLink =
  "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-ui transition-colors hover:bg-accent pointer-coarse:min-h-11";

/**
 * The office's planning view: what is overdue or coming due within 30/60/90
 * days, building by building, with the due states and open defects beside it.
 * Everything follows the customer/building filter.
 */
export async function DueOverview({
  organizationId,
  today,
  soonDays,
  horizon,
  scope,
}: {
  organizationId: string;
  today: string;
  soonDays: number;
  horizon: Horizon;
  scope: OverviewScope;
}) {
  const t = await getTranslations("dashboard");
  const tDue = await getTranslations("devices.due");
  const tSeverity = await getTranslations("defects.severity");
  const format = await getFormatter();
  const supabase = await createClient();
  const count = { count: "exact", head: true } as const;

  // Active devices of the company, narrowed to the customer or building.
  const activeDevices = () => {
    let request = supabase
      .from("devices")
      .select("id, site:sites!inner(customer_id)", count)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "active");
    if (scope.site) request = request.eq("site_id", scope.site);
    if (scope.customer) request = request.eq("site.customer_id", scope.customer);
    return request;
  };
  const dueCount = (state: DueState) => {
    const window = dueWindow(state, today, soonDays);
    const request = activeDevices();
    if (window.kind === "before") return request.lt("next_due_on", window.date);
    if (window.kind === "between")
      return request.gte("next_due_on", window.from).lte("next_due_on", window.to);
    if (window.kind === "after") return request.gt("next_due_on", window.date);
    return request.is("next_due_on", null);
  };
  const defectCount = (severity: "critical" | "major" | "minor") => {
    let request = supabase
      .from("defects")
      .select("id, device:devices!inner(site_id, site:sites!inner(customer_id))", count)
      .eq("organization_id", organizationId)
      .eq("severity", severity)
      .neq("status", "resolved");
    if (scope.site) request = request.eq("device.site_id", scope.site);
    if (scope.customer) request = request.eq("device.site.customer_id", scope.customer);
    return request;
  };
  const { to } = horizonWindow(today, horizon);
  const severities = ["critical", "major", "minor"] as const;

  const [planDevices, dueCounts, defectCounts] = await Promise.all([
    // Overdue and coming due: every active device due by the end of the horizon.
    fetchAll((from, end) => {
      let request = supabase
        .from("devices")
        .select(
          "id, next_due_on, site:sites!inner(id, name, customer_id, customer:customers(name))",
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .eq("status", "active")
        .lte("next_due_on", to);
      if (scope.site) request = request.eq("site_id", scope.site);
      if (scope.customer) request = request.eq("site.customer_id", scope.customer);
      return request.order("id").range(from, end);
    }),
    Promise.all(
      DUE_STATES.map(async (state) => ({ state, count: (await dueCount(state)).count ?? 0 })),
    ),
    Promise.all(
      severities.map(async (severity) => ({
        severity,
        count: (await defectCount(severity)).count ?? 0,
      })),
    ),
  ]);

  const plan = duePlan(
    planDevices.map((device) => ({
      siteId: device.site.id,
      siteName: device.site.name,
      customerName: device.site.customer?.name ?? null,
      nextDueOn: device.next_due_on,
    })),
    today,
    horizon,
  );
  const activeTotal = dueCounts.reduce((sum, entry) => sum + entry.count, 0);
  const openDefects = defectCounts.reduce((sum, entry) => sum + entry.count, 0);
  const day = (date: string) => format.dateTime(calendarDate(date), CALENDAR_FORMAT);
  const scoped = { customer: scope.customer, site: scope.site };

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card>
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 shadow-[0_1px_0_var(--border)]">
          <CardTitle>{t("overview.planTitle")}</CardTitle>
          <nav
            aria-label={t("overview.horizonLabel")}
            className="ms-auto flex rounded-lg bg-accent p-1"
          >
            {HORIZONS.map((days) => (
              <Link
                key={days}
                href={query({ ...scoped, horizon: days === 30 ? undefined : days })}
                scroll={false}
                aria-current={days === horizon ? "page" : undefined}
                className={cn(
                  "flex min-h-8 items-center rounded-md px-3 text-ui whitespace-nowrap transition-colors pointer-coarse:min-h-11",
                  days === horizon
                    ? "bg-background font-medium text-foreground shadow-elevation-1"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {t("overview.horizon", { days })}
              </Link>
            ))}
          </nav>
        </div>
        <p className="px-5 py-2 text-ui text-muted-foreground" aria-live="polite">
          {plan.rows.length > 0
            ? t("overview.summary", {
                overdue: plan.overdue,
                upcoming: plan.upcoming,
                days: horizon,
                sites: plan.rows.length,
              })
            : t("overview.empty", { days: horizon })}
        </p>
        {plan.rows.length > 0 && (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>{t("overview.columns.site")}</TableHeaderCell>
                <TableHeaderCell className="hidden md:table-cell">
                  {t("overview.columns.customer")}
                </TableHeaderCell>
                <TableHeaderCell className="text-end">
                  {t("overview.columns.overdue")}
                </TableHeaderCell>
                <TableHeaderCell className="text-end">
                  {t("overview.columns.upcoming", { days: horizon })}
                </TableHeaderCell>
                <TableHeaderCell className="hidden text-end sm:table-cell">
                  {t("overview.columns.earliest")}
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {plan.rows.slice(0, SHOWN).map((row) => (
                <TableRow key={row.siteId}>
                  <TableCell className="w-full max-w-0 md:w-[34%]">
                    <RowLink href={`/sites/${row.siteId}`} className="block truncate">
                      {row.siteName}
                    </RowLink>
                    <span className="block truncate text-ui-sm text-muted-foreground md:hidden">
                      {row.customerName}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                    {row.customerName}
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    {row.overdue > 0 ? (
                      <Link
                        href={`/devices${query({ site: row.siteId, due: "overdue" })}`}
                        className="relative z-[1]"
                      >
                        <Badge variant="danger" className="tabular-nums hover:underline">
                          {row.overdue}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    {row.upcoming > 0 ? (
                      <Link
                        href={`/devices${query({ site: row.siteId, due: `${horizon}d`, sort: "due" })}`}
                        className="relative z-[1]"
                      >
                        <Badge variant="warning" className="tabular-nums hover:underline">
                          {row.upcoming}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "hidden text-end whitespace-nowrap tabular-nums sm:table-cell",
                      row.earliest < today && "font-semibold text-destructive-text",
                    )}
                  >
                    {day(row.earliest)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {plan.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 px-5 py-2 text-ui shadow-[inset_0_1px_0_var(--border)]">
            {plan.rows.length > SHOWN && (
              <span className="text-muted-foreground">
                {t("overview.moreSites", { count: plan.rows.length - SHOWN })}
              </span>
            )}
            <Link
              href={`/devices${query({ ...scoped, due: `${horizon}d`, sort: "due" })}`}
              className="touch-link text-link hover:underline"
            >
              {t("overview.showDevices", { days: horizon })}
            </Link>
          </div>
        )}
      </Card>

      <div className="space-y-3 sm:space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("dueTitle")}</CardTitle>
          </CardHeader>
          {activeTotal > 0 ? (
            <ul className="p-1.5">
              {dueCounts.map(({ state, count: stateCount }) => (
                <li key={state}>
                  <Link href={`/devices${query({ ...scoped, due: state })}`} className={rowLink}>
                    <Badge
                      variant={stateCount > 0 ? DUE_BADGE[state] : "default"}
                      className="min-w-9 justify-center tabular-nums"
                    >
                      {stateCount}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{tDue(state)}</span>
                    <ChevronRightIcon className="text-subtle rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-2.5 text-ui text-muted-foreground">{t("dueEmpty")}</p>
          )}
          <p className="px-5 pb-2.5 text-ui-sm text-muted-foreground">
            {t("dueHint", { days: soonDays })}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("defectsTitle")}{" "}
              <span className="font-normal text-muted-foreground">({openDefects})</span>
            </CardTitle>
          </CardHeader>
          {openDefects > 0 ? (
            <ul className="p-1.5">
              {defectCounts.map(({ severity, count: severityCount }) => (
                <li key={severity}>
                  <Link href={`/defects${query({ ...scoped, severity })}`} className={rowLink}>
                    <Badge
                      variant={severityCount > 0 ? SEVERITY_BADGE[severity] : "default"}
                      className="min-w-9 justify-center tabular-nums"
                    >
                      {severityCount}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{tSeverity(severity)}</span>
                    <ChevronRightIcon className="text-subtle rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-2.5 text-ui text-muted-foreground">{t("defectsEmpty")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
