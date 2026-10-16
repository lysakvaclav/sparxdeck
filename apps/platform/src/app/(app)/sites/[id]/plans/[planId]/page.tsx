import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DownloadIcon, LayersIcon } from "@/components/icons";
import { DeleteButton } from "@/components/app/delete-button";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isManager, requireMembership } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/due";
import { getFloorPlan, planDevices, sitePlans } from "@/lib/floor-plans-data";
import { getSite } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { idSchema } from "@/lib/validation";
import { deleteFloorPlan } from "../../../plan-actions";
import { PlanEditActions } from "./plan-actions-menu";
import { PlanWorkspace } from "./plan-workspace";

type Props = {
  params: Promise<{ id: string; planId: string }>;
  searchParams: Promise<{ place?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, planId } = await params;
  const plan = await getFloorPlan(id, planId);
  return { title: plan?.name };
}

export default async function FloorPlanPage({ params, searchParams }: Props) {
  const { id, planId } = await params;
  const { place } = await searchParams;
  const { membership, organization } = await requireMembership();
  const site = await getSite(id);
  if (!site) notFound();
  const plan = await getFloorPlan(site.id, planId);
  if (!plan) notFound();
  const t = await getTranslations("plans");
  const tCustomers = await getTranslations("customers");
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const [plans, devices, { data: locations }] = await Promise.all([
    sitePlans(site.id),
    planDevices(site.id, todayInTimeZone(organization.timezone), organization.due_soon_days),
    supabase
      .from("locations")
      .select("id, name")
      .eq("site_id", site.id)
      .order("sort_order")
      .order("created_at"),
  ]);
  const summary = plans.find((item) => item.id === plan.id);
  const siteHref = `/sites/${site.id}`;

  return (
    <>
      <PageHeader
        icon={LayersIcon}
        iconClassName="text-node-location"
        title={plan.name}
        meta={
          plan.location && plan.location.name !== plan.name && <Badge>{plan.location.name}</Badge>
        }
        breadcrumbs={[
          { label: tCustomers("title"), href: "/customers" },
          ...(site.customer
            ? [{ label: site.customer.name, href: `/customers/${site.customer.id}` }]
            : []),
          { label: site.name, href: siteHref },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/sites/${site.id}/plans/${plan.id}/pdf`} download>
                <DownloadIcon />
                {t("detail.download")}
              </a>
            </Button>
            {manager && (
              <>
                <PlanEditActions
                  siteId={site.id}
                  plan={{ id: plan.id, name: plan.name, locationId: plan.location_id }}
                  locations={locations ?? []}
                />
                <DeleteButton
                  title={t("detail.deleteTitle")}
                  description={t("detail.deleteBody", { name: plan.name })}
                  action={deleteFloorPlan.bind(null, plan.id)}
                  redirectTo={`${siteHref}#plans`}
                />
              </>
            )}
          </>
        }
      />

      <PageBody>
        {plans.length > 1 && (
          <nav aria-label={t("detail.plans")} className="mb-2.5 sm:mb-[15px]">
            <ul className="flex scrollbar-thin gap-1 overflow-x-auto rounded-md bg-muted p-0.5">
              {plans.map((item) => (
                <li key={item.id} className="shrink-0">
                  <Link
                    href={`/sites/${site.id}/plans/${item.id}`}
                    aria-current={item.id === plan.id ? "page" : undefined}
                    className={cn(
                      "flex min-h-[30px] items-center gap-1.5 rounded-[3px] px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                      item.id === plan.id
                        ? "bg-background font-semibold shadow-elevation-1"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.name}
                    <span className="text-muted-foreground tabular-nums">{item.placed}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <PlanWorkspace
          key={plan.id}
          plan={{
            id: plan.id,
            name: plan.name,
            width: plan.image_width,
            height: plan.image_height,
            imageUrl: summary?.imageUrl ?? null,
            locationId: plan.location_id,
          }}
          plans={plans.map((item) => ({ id: item.id, name: item.name }))}
          devices={devices}
          editable={manager}
          placeId={place && idSchema.safeParse(place).success ? place : null}
        />
      </PageBody>
    </>
  );
}
