import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeftIcon, ChevronRightIcon, WarningSignIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanButton } from "@/components/app/plan-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { monthGrid, parseMonth, shiftMonth, upcomingWeeks, workload } from "@/lib/calendar";
import { loadCalendarMonth, loadWorkload } from "@/lib/calendar-data";
import { addDays, calendarDate, todayInTimeZone } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { getDeviceFormOptions } from "@/lib/records";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { idSchema } from "@/lib/validation";
import { CalendarFilters } from "./calendar-filters";
import { CalendarMonth } from "./calendar-month";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

/** Weeks shown in the workload view (this week and the next ones). */
const WORKLOAD_WEEKS = 8;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const validId = (value: string | undefined) =>
  value && idSchema.safeParse(value).success ? value : undefined;

/**
 * Planning: a month of planned visits and inspection due dates, or the
 * technicians' workload in the coming weeks. Filters and the month are in the URL.
 */
export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("calendar");
  const format = await getFormatter();
  const params = await searchParams;
  const today = todayInTimeZone(organization.timezone);
  const month = parseMonth(first(params.month), today);
  const view = first(params.view) === "workload" ? "workload" : "month";
  const customer = validId(first(params.customer));
  const technicianParam = first(params.technician);
  const technician = technicianParam === "none" ? "none" : validId(technicianParam);
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const [names, options, customers] = await Promise.all([
    memberNames(organization.id),
    manager ? getDeviceFormOptions(organization.id) : Promise.resolve(null),
    fetchAll((start, end) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(start, end),
    ),
  ]);
  const members = [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sites = (options?.sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    customerId: site.customerId,
    customerName: site.customerName,
  }));

  const href = (patch: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const all = {
      month: month === today.slice(0, 7) ? undefined : month,
      view,
      customer,
      technician,
      ...patch,
    };
    for (const [key, value] of Object.entries(all))
      if (value && !(key === "view" && value === "month")) search.set(key, value);
    const query = search.toString();
    return query ? `/calendar?${query}` : "/calendar";
  };
  const app = appIcon("calendar");
  const monthName = format.dateTime(calendarDate(`${month}-01`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          manager && (
            <PlanButton
              variant="primary"
              label={t("plan.title")}
              initial={{ siteId: "", plannedOn: today, technicianId: "", note: "" }}
              sites={sites}
              members={members}
            />
          )
        }
      />
      <PageBody>
        <div className="mb-2.5 flex flex-col gap-2.5 sm:mb-[15px] lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={t("views")} className="flex self-start rounded-lg bg-canvas p-0.5">
            {(["month", "workload"] as const).map((option) => (
              <Link
                key={option}
                href={href({ view: option })}
                aria-current={view === option ? "page" : undefined}
                className={cn(
                  "flex min-h-[26px] items-center rounded-md px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                  view === option
                    ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`view.${option}`)}
              </Link>
            ))}
          </nav>
          {view === "month" && (
            <CalendarFilters
              customer={customer}
              technician={technician}
              customers={customers}
              members={members}
            />
          )}
        </div>

        {view === "month" ? (
          <MonthView
            organizationId={organization.id}
            month={month}
            monthName={monthName}
            today={today}
            filters={{ customer, technician }}
            members={members}
            sites={sites}
            manager={manager}
            prevHref={href({ month: shiftMonth(month, -1) })}
            nextHref={href({ month: shiftMonth(month, 1) })}
            todayHref={href({ month: undefined })}
            isCurrentMonth={month === today.slice(0, 7)}
          />
        ) : (
          <WorkloadView organizationId={organization.id} today={today} members={members} />
        )}
      </PageBody>
    </>
  );
}

async function MonthView({
  organizationId,
  month,
  monthName,
  today,
  filters,
  members,
  sites,
  manager,
  prevHref,
  nextHref,
  todayHref,
  isCurrentMonth,
}: {
  organizationId: string;
  month: string;
  monthName: string;
  today: string;
  filters: { customer?: string; technician?: string };
  members: { id: string; name: string }[];
  sites: { id: string; name: string; customerId: string; customerName: string }[];
  manager: boolean;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  isCurrentMonth: boolean;
}) {
  const t = await getTranslations("calendar");
  const data = await loadCalendarMonth(organizationId, month, today, filters);
  const missed = data.plans.filter((plan) => plan.state === "missed").length;

  return (
    <div className="space-y-2.5 sm:space-y-[15px]">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href={prevHref} aria-label={t("previous")}>
            <ChevronLeftIcon className="rtl:rotate-180" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon">
          <Link href={nextHref} aria-label={t("next")}>
            <ChevronRightIcon className="rtl:rotate-180" />
          </Link>
        </Button>
        <h2 className="text-ui-lg font-semibold first-letter:uppercase" aria-live="polite">
          {monthName}
        </h2>
        {!isCurrentMonth && (
          <Button asChild variant="ghost" size="sm">
            <Link href={todayHref}>{t("today")}</Link>
          </Button>
        )}
      </div>
      {(data.overdue > 0 || missed > 0) && (
        <Alert variant="warning" icon={WarningSignIcon} title={t("attention")}>
          <ul className="space-y-0.5">
            {data.overdue > 0 && (
              <li>
                <Link
                  href="/devices?due=overdue&sort=due"
                  className="touch-link text-link underline"
                >
                  {t("overdueDevices", { count: data.overdue })}
                </Link>
              </li>
            )}
            {missed > 0 && <li>{t("missedPlans", { count: missed })}</li>}
          </ul>
        </Alert>
      )}
      <CalendarMonth
        weeks={monthGrid(month)}
        month={month}
        today={today}
        plans={data.plans}
        due={data.due}
        members={members}
        sites={sites}
        manager={manager}
      />
    </div>
  );
}

async function WorkloadView({
  organizationId,
  today,
  members,
}: {
  organizationId: string;
  today: string;
  members: { id: string; name: string }[];
}) {
  const t = await getTranslations("calendar");
  const format = await getFormatter();
  const weeks = upcomingWeeks(today, WORKLOAD_WEEKS);
  const { plans, devicesBySite } = await loadWorkload(
    organizationId,
    weeks[0]!,
    addDays(weeks.at(-1)!, 7),
  );
  const rows = workload(
    plans,
    devicesBySite,
    members.map((member) => member.id),
    weeks,
  );
  const names = new Map(members.map((member) => [member.id, member.name]));
  const range = (monday: string) =>
    format.dateTimeRange(calendarDate(monday), calendarDate(addDays(monday, 6)), {
      day: "numeric",
      month: "numeric",
      timeZone: "UTC",
    });
  const busiest = Math.max(1, ...rows.flatMap((row) => row.weeks.map((cell) => cell.visits)));

  return (
    <Card>
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell className="min-w-40">{t("workload.technician")}</TableHeaderCell>
            {weeks.map((monday, index) => (
              <TableHeaderCell key={monday} className="text-center">
                <span className="block">
                  {index === 0 ? t("workload.thisWeek") : range(monday)}
                </span>
              </TableHeaderCell>
            ))}
            <TableHeaderCell className="text-end">{t("workload.total")}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.technicianId ?? "none"}>
              <TableCell className="font-medium whitespace-nowrap">
                {row.technicianId
                  ? (names.get(row.technicianId) ?? t("formerMember"))
                  : t("plan.unassigned")}
              </TableCell>
              {row.weeks.map((cell, index) => (
                <TableCell
                  key={weeks[index]}
                  className="text-center whitespace-nowrap tabular-nums"
                >
                  {cell.visits > 0 ? (
                    <span
                      className={cn(
                        "inline-flex flex-col rounded-md px-2 py-0.5",
                        // The busiest weeks stand out (a tint, the numbers carry the meaning).
                        cell.visits / busiest >= 0.75 ? "bg-primary/15" : "bg-muted",
                      )}
                    >
                      <span className="font-semibold">
                        {t("workload.visits", { count: cell.visits })}
                      </span>
                      <span
                        className={cn(
                          "text-ui-sm",
                          // Grey text falls below 4.5:1 on the blue of a busy week.
                          cell.visits / busiest >= 0.75
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {t("workload.devices", { count: cell.devices })}
                      </span>
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TableCell>
              ))}
              <TableCell className="text-end whitespace-nowrap tabular-nums">
                <span className="font-semibold">
                  {t("workload.visits", { count: row.total.visits })}
                </span>
                <span className="block text-ui-sm text-muted-foreground">
                  {t("workload.devices", { count: row.total.devices })}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <caption className="caption-bottom px-[15px] py-2 text-start text-ui-sm text-muted-foreground">
          {t("workload.hint", { weeks: WORKLOAD_WEEKS })}
        </caption>
      </Table>
    </Card>
  );
}
