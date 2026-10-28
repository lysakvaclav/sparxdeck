import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireMembership } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/due";
import { loadTodayRoutes } from "@/lib/route-plans-data";
import { TodayPlan } from "./today-plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes.today");
  return { title: t("title") };
}

/**
 * The technician's plan for today on the phone (part 23): the stops of their
 * routes for the day, marked visited even without a signal. The page is kept
 * in the phone (public/sw.js) and the marks wait there until they can be sent.
 */
export default async function TodayPage() {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("routes");
  const today = todayInTimeZone(organization.timezone);
  const routes = await loadTodayRoutes(organization.id, membership.user_id, today);
  const app = appIcon("routes");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("today.title")}
        breadcrumbs={[
          { label: organization.name, href: "/" },
          { label: t("title"), href: "/routes" },
        ]}
      />
      <PageBody width="narrow">
        <TodayPlan routes={routes} day={today} timeZone={organization.timezone} userId={membership.user_id} />
      </PageBody>
    </>
  );
}
