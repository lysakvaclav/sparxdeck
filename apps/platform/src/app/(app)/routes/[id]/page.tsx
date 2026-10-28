import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/app/delete-button";
import { appIcon } from "@/components/app/nav-items";
import { PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { calendarDate, todayInTimeZone } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { loadRoute } from "@/lib/route-plans-data";
import { idSchema } from "@/lib/validation";
import { deleteRoute } from "../actions";
import { RouteDialog } from "../route-dialog";
import { RouteEditor } from "./route-editor";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title") };
}

/** One route (part 23): its stops in order, the start point and the map. */
export default async function RoutePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { membership, organization } = await requireMembership();
  const company =
    organization.base_latitude != null && organization.base_longitude != null
      ? { latitude: organization.base_latitude, longitude: organization.base_longitude }
      : null;
  const [route, names, t, format] = await Promise.all([
    loadRoute(organization.id, id, company),
    memberNames(organization.id),
    getTranslations("routes"),
    getFormatter(),
  ]);
  if (!route) notFound();

  const manager = isManager(membership.role);
  const members = [...names]
    .map(([memberId, name]) => ({ id: memberId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // dateStyle can't go with a weekday: the parts one by one, in UTC like every calendar date.
  const day = format.dateTime(calendarDate(route.plannedOn), {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const technician = route.technicianId
    ? (names.get(route.technicianId) ?? t("formerMember"))
    : t("unassigned");
  const app = appIcon("routes");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={`${route.name || t("untitled")} · ${day} · ${technician}`}
        breadcrumbs={[
          { label: organization.name, href: "/" },
          { label: t("title"), href: "/routes" },
        ]}
        actions={
          <div className="flex gap-2">
            <RouteDialog
              routeId={route.id}
              variant="outline"
              initial={{ plannedOn: route.plannedOn, technicianId: route.technicianId ?? "", name: route.name }}
              members={members}
              canChooseTechnician={manager}
            />
            <DeleteButton
              title={t("delete.title")}
              description={t("delete.description")}
              action={deleteRoute.bind(null, route.id)}
              redirectTo="/routes"
            />
          </div>
        }
      />
      <RouteEditor
        route={route}
        today={todayInTimeZone(organization.timezone)}
        soonDays={organization.due_soon_days}
      />
    </>
  );
}
