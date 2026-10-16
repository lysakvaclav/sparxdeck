import "server-only";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader, type Crumb } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { getDeviceFormOptions, type SiteOption } from "@/lib/records";
import type { DeviceFormValues } from "./device-form";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Options and defaults for adding devices: ?site= preselects a building (and
 * ?location= one of its locations). Null when there is no building to add to.
 */
export async function deviceFormContext(params: Record<string, string | string[] | undefined>) {
  const { membership, organization } = await requireMembership();
  if (!isManager(membership.role)) redirect("/devices");
  const { sites, types } = await getDeviceFormOptions(organization.id);
  if (sites.length === 0 || types.length === 0) return null;

  const site = sites.find((option) => option.id === first(params.site)) ?? null;
  const location = site?.locations.find((option) => option.id === first(params.location));
  const defaults: Partial<DeviceFormValues> = {
    siteId: site?.id ?? "",
    locationId: location?.id ?? "",
    deviceTypeId: types[0]!.id,
  };
  return { sites, types, site, defaults, cancelHref: site ? `/sites/${site.id}` : "/devices" };
}

/** Page frame of the device forms: header with the building's path, narrow card. */
export async function DeviceFormPage({
  title,
  site,
  crumbs,
  children,
}: {
  title: string;
  site:
    (Pick<SiteOption, "id" | "name"> & { customer?: { id: string; name: string } | null }) | null;
  crumbs?: Crumb[];
  children: React.ReactNode;
}) {
  const tDevices = await getTranslations("devices");
  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.device.icon}
        iconClassName={OBJECT_TYPES.device.text}
        title={title}
        breadcrumbs={
          crumbs ?? [
            { label: tDevices("title"), href: "/devices" },
            ...(site ? [{ label: site.name, href: `/sites/${site.id}` }] : []),
          ]
        }
      />
      <PageBody width="narrow">
        <Card>{children}</Card>
      </PageBody>
    </>
  );
}
