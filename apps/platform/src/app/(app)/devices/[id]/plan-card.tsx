import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayersIcon, PinIcon, UploadIcon } from "@/components/icons";
import { PlanViewer } from "@/components/app/plan-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DueState } from "@/lib/due";
import { devicePlacement, sitePlans } from "@/lib/floor-plans-data";
import { DUE_TONE } from "@/components/app/plan-tones";

/**
 * Where the device is on the building's floor plan: a small plan centred on it,
 * or (owners and admins) links to place it on one of the building's plans.
 */
export async function DevicePlanCard({
  device,
  siteId,
  manager,
}: {
  device: { id: string; label: string; typeName: string; due: DueState };
  siteId: string;
  manager: boolean;
}) {
  const t = await getTranslations("plans");
  const placement = await devicePlacement(device.id);

  if (placement) {
    const planHref = `/sites/${placement.plan.siteId}/plans/${placement.plan.id}`;
    return (
      <Card className="overflow-hidden">
        <CardHeader
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={planHref}>
                <LayersIcon />
                {t("device.open")}
              </Link>
            </Button>
          }
        >
          <CardTitle>{t("device.title")}</CardTitle>
        </CardHeader>
        <PlanViewer
          name={placement.plan.name}
          imageUrl={placement.plan.imageUrl}
          size={{ width: placement.plan.width, height: placement.plan.height }}
          markers={[
            {
              id: device.id,
              x: placement.x,
              y: placement.y,
              label: device.label,
              tone: DUE_TONE[device.due],
              description: t("viewer.marker", {
                label: device.label,
                type: device.typeName,
                state: t(`legend.${device.due}`),
              }),
            },
          ]}
          selectedId={device.id}
          focusId={device.id}
          className="h-[260px]"
        />
        <p className="truncate px-[15px] py-2 text-ui-sm text-muted-foreground shadow-[inset_0_1px_0_var(--border)]">
          {placement.plan.name}
        </p>
      </Card>
    );
  }

  const plans = await sitePlans(siteId);
  if (!manager && plans.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("device.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-ui text-muted-foreground">
          {plans.length ? t("device.notPlaced") : t("device.noPlans")}
        </p>
        {manager && (
          <div className="flex flex-wrap gap-2">
            {plans.length ? (
              plans.slice(0, 6).map((plan) => (
                <Button key={plan.id} asChild variant="outline" size="sm">
                  <Link href={`/sites/${siteId}/plans/${plan.id}?place=${device.id}`}>
                    <PinIcon />
                    {plans.length === 1
                      ? t("device.place")
                      : t("device.placeOn", { plan: plan.name })}
                  </Link>
                </Button>
              ))
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={`/sites/${siteId}#plans`}>
                  <UploadIcon />
                  {t("device.uploadPlan")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
