import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeviceForm } from "../device-form";
import { DeviceFormPage, deviceFormContext } from "../form-page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("devices.form");
  return { title: t("bulkTitle") };
}

export default async function BulkDevicesPage({ searchParams }: Props) {
  const context = await deviceFormContext(await searchParams);
  if (!context) redirect("/devices");
  const t = await getTranslations("devices.form");

  return (
    <DeviceFormPage title={t("bulkTitle")} site={context.site}>
      <DeviceForm
        mode="bulk"
        sites={context.sites}
        types={context.types}
        defaults={context.defaults}
        cancelHref={context.cancelHref}
      />
    </DeviceFormPage>
  );
}
