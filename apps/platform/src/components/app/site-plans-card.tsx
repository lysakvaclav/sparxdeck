import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlanButton } from "@/components/app/plan-dialog";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { loadUpcomingPlans } from "@/lib/calendar-data";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { getDeviceFormOptions } from "@/lib/records";

/** A building's next planned visits; managers plan one from here. */
export async function SitePlansCard({
  organizationId,
  siteId,
  today,
  manager,
}: {
  organizationId: string;
  siteId: string;
  today: string;
  manager: boolean;
}) {
  const t = await getTranslations("calendar");
  const format = await getFormatter();
  const [plans, names, options] = await Promise.all([
    loadUpcomingPlans(organizationId, today, { site: siteId }),
    memberNames(organizationId),
    manager ? getDeviceFormOptions(organizationId) : Promise.resolve(null),
  ]);
  const members = [...names].map(([id, name]) => ({ id, name }));

  return (
    <Card>
      <CardHeader
        actions={
          options && (
            <PlanButton
              label={t("siteCard.plan")}
              initial={{ siteId, plannedOn: today, technicianId: "", note: "" }}
              sites={options.sites.map((site) => ({
                id: site.id,
                name: site.name,
                customerId: site.customerId,
                customerName: site.customerName,
              }))}
              members={members}
            />
          )
        }
      >
        <CardTitle>{t("siteCard.title")}</CardTitle>
      </CardHeader>
      {plans.length > 0 ? (
        <ul>
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
            >
              <Link
                href={`/calendar?month=${plan.plannedOn.slice(0, 7)}`}
                className="font-medium text-link tabular-nums hover:underline"
              >
                {format.dateTime(calendarDate(plan.plannedOn), CALENDAR_FORMAT)}
              </Link>
              <span className="text-muted-foreground">
                {" · "}
                {plan.technicianId
                  ? (names.get(plan.technicianId) ?? t("formerMember"))
                  : t("plan.unassigned")}
              </span>
              {plan.note && (
                <p className="text-ui-sm break-words text-muted-foreground">{plan.note}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-[15px] py-2.5 text-muted-foreground">{t("siteCard.empty")}</p>
      )}
    </Card>
  );
}
