import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireMembership } from "@/lib/auth";
import { formatLabel } from "@/lib/devices";
import { LABELS_COOKIE, readLabelPrefs } from "@/lib/labels";
import { serverEnv } from "@/lib/env";
import { labelUrl } from "@/lib/qr";
import { getDeviceFormOptions } from "@/lib/records";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { LabelPrinter, type PrintDevice } from "./label-printer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("labels");
  return { title: t("title") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Printing labels for one building: its devices in route order (removed ones
 * left out), all selected, or only ?device= when coming from a device.
 */
export default async function LabelsPage({ searchParams }: Props) {
  const { organization } = await requireMembership();
  const params = await searchParams;
  const t = await getTranslations("labels");
  const tDevices = await getTranslations("devices");
  const { sites } = await getDeviceFormOptions(organization.id);
  const site = sites.find((option) => option.id === first(params.site)) ?? null;

  let devices: PrintDevice[] = [];
  if (site) {
    const supabase = await createClient();
    const rows = await fetchAll((from, to) =>
      supabase
        .from("devices")
        .select(
          "id, label_number, public_token, serial_number, location:locations(name, sort_order), type:device_types(name)",
        )
        .eq("site_id", site.id)
        .is("deleted_at", null)
        .neq("status", "removed")
        .order("label_number")
        .range(from, to),
    );
    const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
    devices = rows
      .sort(
        (a, b) =>
          (a.location?.sort_order ?? Number.MAX_SAFE_INTEGER) -
            (b.location?.sort_order ?? Number.MAX_SAFE_INTEGER) || a.label_number - b.label_number,
      )
      .map((row) => ({
        id: row.id,
        number: formatLabel(row.label_number),
        typeName: row.type?.name ?? "",
        locationName: row.location?.name ?? null,
        serialNumber: row.serial_number,
        siteName: site.name,
        url: labelUrl(appUrl, row.public_token),
      }));
  }
  const only = first(params.device);
  const preselected = devices.some((device) => device.id === only)
    ? [only!]
    : devices.map((device) => device.id);

  const app = appIcon("devices");
  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[
          { label: tDevices("title"), href: "/devices" },
          ...(site ? [{ label: site.name, href: `/sites/${site.id}` }] : []),
        ]}
      />
      <PageBody>
        <LabelPrinter
          // A new building (or device) starts a fresh selection.
          key={`${site?.id ?? ""}:${only ?? ""}`}
          sites={sites.map(({ id, name, customerId, customerName }) => ({
            id,
            name,
            customerId,
            customerName,
          }))}
          siteId={site?.id ?? null}
          devices={devices}
          preselected={preselected}
          organizationName={organization.name}
          prefs={readLabelPrefs((await cookies()).get(LABELS_COOKIE)?.value)}
        />
      </PageBody>
    </>
  );
}
