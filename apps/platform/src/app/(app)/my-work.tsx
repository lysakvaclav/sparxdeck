import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarIcon, ChevronRightIcon, IssueIcon, RouteIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { loadUpcomingPlans } from "@/lib/calendar-data";
import { CALENDAR_FORMAT, addDays, calendarDate } from "@/lib/due";
import { createClient } from "@/lib/supabase/server";

/** How far ahead the signed-in user's planned visits are listed. */
const DAYS_AHEAD = 14;

const rowLink =
  "flex min-h-[30px] items-center gap-[7px] rounded-sm px-[7px] text-ui transition-colors hover:bg-accent pointer-coarse:min-h-11";

/**
 * The signed-in member's own work: visits planned for them in the next two weeks
 * and unresolved defects assigned to them. Hidden when there is none.
 */
export async function MyWork({
  organizationId,
  userId,
  today,
}: {
  organizationId: string;
  userId: string;
  today: string;
}) {
  const supabase = await createClient();
  const [plans, { count: defects }, { count: overdue }, { data: routes }] = await Promise.all([
    loadUpcomingPlans(organizationId, today, { technician: userId }, 5),
    supabase
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("assigned_to", userId)
      .neq("status", "resolved"),
    supabase
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("assigned_to", userId)
      .neq("status", "resolved")
      .lt("due_on", today),
    // Today's routes (part 23): the way to the plan for today on the phone.
    supabase
      .from("route_plans")
      .select("id, name, route_plan_stops(visited_at)")
      .eq("organization_id", organizationId)
      .eq("technician_id", userId)
      .eq("planned_on", today),
  ]);
  const soon = plans.filter((plan) => plan.plannedOn <= addDays(today, DAYS_AHEAD));
  const todayRoutes = (routes ?? []).filter((route) => route.route_plan_stops.length > 0);
  if (soon.length === 0 && !defects && todayRoutes.length === 0) return null;

  const t = await getTranslations("dashboard.myWork");
  const format = await getFormatter();
  const calendar = appIcon("calendar");
  const defectsApp = appIcon("defects");
  const routesApp = appIcon("routes");

  return (
    <Card className="mt-2.5 sm:mt-[15px]" data-testid="my-work">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <ul className="p-[5px]">
        {todayRoutes.map((route) => (
          <li key={route.id}>
            <Link href="/routes/today" className={rowLink}>
              <RouteIcon className={routesApp.tone} />
              <span className="min-w-0 flex-1 truncate">
                {t("route", {
                  name: route.name || t("routeUntitled"),
                  visited: route.route_plan_stops.filter((stop) => stop.visited_at).length,
                  count: route.route_plan_stops.length,
                })}
              </span>
              <ChevronRightIcon className="text-subtle rtl:rotate-180" />
            </Link>
          </li>
        ))}
        {soon.map((plan) => (
          <li key={plan.id}>
            <Link href={`/sites/${plan.siteId}`} className={rowLink}>
              <CalendarIcon className={calendar.tone} />
              <span className="min-w-0 flex-1 truncate">
                <span className="tabular-nums">
                  {plan.plannedOn === today
                    ? t("today")
                    : format.dateTime(calendarDate(plan.plannedOn), CALENDAR_FORMAT)}
                </span>
                {" · "}
                {plan.siteName}
                <span className="text-muted-foreground"> · {plan.customerName}</span>
              </span>
              <ChevronRightIcon className="text-subtle rtl:rotate-180" />
            </Link>
          </li>
        ))}
        {!!defects && (
          <li>
            <Link href="/defects?assignee=me&sort=due" className={rowLink}>
              <IssueIcon className={defectsApp.tone} />
              <span className="min-w-0 flex-1 py-1">
                {t("defects", { count: defects })}
                {!!overdue && (
                  <span className="font-semibold text-destructive-text">
                    {" · "}
                    {t("overdue", { count: overdue })}
                  </span>
                )}
              </span>
              <ChevronRightIcon className="text-subtle rtl:rotate-180" />
            </Link>
          </li>
        )}
      </ul>
    </Card>
  );
}
