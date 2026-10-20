import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CubeIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { deviceTypeFields } from "@/lib/devices";
import { getDeviceType } from "@/lib/records";
import { DeviceTypeForm } from "../../device-type-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deviceTypes.form");
  return { title: t("title") };
}

export default async function EditDeviceTypePage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/device-types/${id}`);
  const type = await getDeviceType(id);
  if (!type) notFound();
  const t = await getTranslations("deviceTypes");

  return (
    <>
      <PageHeader
        icon={CubeIcon}
        iconClassName={appIcon("deviceTypes").tone}
        title={t("form.title")}
        breadcrumbs={[
          { label: t("title"), href: "/device-types" },
          { label: type.name, href: `/device-types/${type.id}` },
        ]}
      />
      <PageBody width="narrow">
        <DeviceTypeForm
          mode="edit"
          id={type.id}
          defaults={{ name: type.name, interval: type.inspection_interval_months }}
          fields={deviceTypeFields(type.custom_fields)}
        />
      </PageBody>
    </>
  );
}
