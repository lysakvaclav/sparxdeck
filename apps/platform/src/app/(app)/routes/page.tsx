import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { RouteIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  RowLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { calendarDate, todayInTimeZone } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { distanceParts } from "@/lib/route-plans";
import { loadRouteList } from "@/lib/route-plans-data";
import { cn } from "@/lib/utils";
import { idSchema } from "@/lib/validation";
import { RouteDialog } from "./route-dialog";
import { TechnicianFilter } from "./technician-filter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Routes for technicians (part 23): days of visits ordered by straight-line
 * distance. Owners and admins see everyone's, a technician their own.
 */
export default async function RoutesPage({ searchParams }: { searchParams: SearchParams }) {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("routes");
  const format = await getFormatter();
  const params = await searchParams;
  const manager = isManager(membership.role);
  const today = todayInTimeZone(organization.timezone);
  const when = first(params.when) === "past" ? "past" : "upcoming";
  const technicianParam = first(params.technician);
  const technician =
    manager && technicianParam && idSchema.safeParse(technicianParam).success ? technicianParam : undefined;

  const [rows, names] = await Promise.all([
    loadRouteList(organization.id, { today, when, technician }),
    memberNames(organization.id),
  ]);
  const members = [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const href = (patch: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ when, technician, ...patch }))
      if (value && !(key === "when" && value === "upcoming")) search.set(key, value);
    const query = search.toString();
    return query ? `/routes?${query}` : "/routes";
  };
  const distance = (metres: number) => {
    const { value, unit } = distanceParts(metres);
    return t(`distance.${unit}`, { value: format.number(value) });
  };
  const app = appIcon("routes");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          <RouteDialog
            initial={{ plannedOn: today, technicianId: manager ? "" : membership.user_id, name: "" }}
            members={members}
            canChooseTechnician={manager}
          />
        }
      />
      <PageBody>
        <div className="mb-2.5 flex flex-col gap-2.5 sm:mb-[15px] sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label={t("views")} className="flex self-start rounded-lg bg-canvas p-0.5">
            {(["upcoming", "past"] as const).map((option) => (
              <Link
                key={option}
                href={href({ when: option })}
                aria-current={when === option ? "page" : undefined}
                className={cn(
                  "flex min-h-[26px] items-center rounded-md px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                  when === option
                    ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`when.${option}`)}
              </Link>
            ))}
          </nav>
          {manager && <TechnicianFilter value={technician ?? ""} members={members} when={when} />}
        </div>
        <Alert className="mb-2.5 sm:mb-[15px]">{t("straightLine")}</Alert>
        <Card>
          {rows.length > 0 ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>{t("columns.day")}</TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">{t("columns.name")}</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">{t("columns.technician")}</TableHeaderCell>
                  <TableHeaderCell className="text-end">{t("columns.stops")}</TableHeaderCell>
                  <TableHeaderCell className="hidden text-end md:table-cell">{t("columns.distance")}</TableHeaderCell>
                  <TableHeaderCell className="hidden lg:table-cell">{t("columns.state")}</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      <RowLink href={`/routes/${row.id}`}>
                        {format.dateTime(calendarDate(row.plannedOn), {
                          weekday: "short",
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </RowLink>
                      <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                        {row.name || row.technicianName || t("untitled")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-0 sm:table-cell sm:w-[30%]">
                      <span className="block truncate">{row.name || "—"}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.technicianId ? (row.technicianName ?? t("formerMember")) : t("unassigned")}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      {t("stopsCount", { visited: row.visited, count: row.stops })}
                    </TableCell>
                    <TableCell className="hidden text-end whitespace-nowrap tabular-nums md:table-cell">
                      {row.distance !== null ? distance(row.distance) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={row.state === "done" ? "success" : row.state === "underway" ? "primaryMinimal" : "outline"}>
                        {t(`state.${row.state}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={RouteIcon} title={when === "past" ? t("emptyPast") : t("empty")} />
          )}
        </Card>
      </PageBody>
    </>
  );
}
