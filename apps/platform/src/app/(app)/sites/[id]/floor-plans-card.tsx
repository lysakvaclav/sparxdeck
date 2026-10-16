import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayersIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sitePlans } from "@/lib/floor-plans-data";
import { PlanOrderMenu, UploadPlanButton } from "./plans/plan-controls";

/** The building's floor plans as thumbnails; owners and admins upload and order them. */
export async function SiteFloorPlansCard({
  siteId,
  manager,
  locations,
}: {
  siteId: string;
  manager: boolean;
  locations: { id: string; name: string }[];
}) {
  const t = await getTranslations("plans");
  const plans = await sitePlans(siteId);
  const order = plans.map((plan) => plan.id);

  return (
    <Card id="plans">
      <CardHeader actions={manager && <UploadPlanButton siteId={siteId} locations={locations} />}>
        <CardTitle>
          {t("title")} <span className="font-normal text-muted-foreground">({plans.length})</span>
        </CardTitle>
        <CardDescription className="hidden sm:block">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <LayersIcon size={20} className="text-subtle" />
            <p className="max-w-md text-ui text-muted-foreground">
              {manager ? t("empty") : t("emptyReadOnly")}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => (
              <li
                key={plan.id}
                className="group relative overflow-hidden rounded-md bg-background shadow-[inset_0_0_0_1px_var(--border)]"
              >
                <Link
                  href={`/sites/${siteId}/plans/${plan.id}`}
                  className="block outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
                >
                  <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white p-1.5">
                    {plan.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img
                        src={plan.imageUrl}
                        alt=""
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <LayersIcon size={20} className="text-subtle" />
                    )}
                  </span>
                  <span className="block px-2.5 py-2 shadow-[inset_0_1px_0_var(--border)]">
                    <span className="block truncate pe-8 font-semibold text-link group-hover:underline">
                      {plan.name}
                    </span>
                    <span className="block truncate text-ui-sm text-muted-foreground">
                      {[
                        plan.locationName !== plan.name ? plan.locationName : null,
                        t("devicesCount", { count: plan.placed }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
                {manager && plans.length > 1 && (
                  <div className="absolute end-1 bottom-1.5">
                    <PlanOrderMenu siteId={siteId} order={order} index={index} name={plan.name} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
