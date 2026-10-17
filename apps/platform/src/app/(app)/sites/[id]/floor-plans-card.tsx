import { getTranslations } from "next-intl/server";
import { LayersIcon } from "@/components/icons";
import { PlanTile, planNote } from "@/components/app/plan-tile";
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
              <PlanTile
                key={plan.id}
                href={`/sites/${siteId}/plans/${plan.id}`}
                name={plan.name}
                note={planNote(plan, t("devicesCount", { count: plan.placed }))}
                imageUrl={plan.imageUrl}
              >
                {manager && plans.length > 1 && (
                  <PlanOrderMenu siteId={siteId} order={order} index={index} name={plan.name} />
                )}
              </PlanTile>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
