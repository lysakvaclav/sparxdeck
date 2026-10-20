import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CubeIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { DeviceTypeForm } from "../device-type-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deviceTypes.form");
  return { title: t("newTitle") };
}

export default async function NewDeviceTypePage() {
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect("/device-types");
  const t = await getTranslations("deviceTypes");

  return (
    <>
      <PageHeader
        icon={CubeIcon}
        iconClassName={appIcon("deviceTypes").tone}
        title={t("form.newTitle")}
        breadcrumbs={[{ label: t("title"), href: "/device-types" }]}
      />
      <PageBody width="narrow">
        <DeviceTypeForm mode="create" defaults={{ name: "", interval: 12 }} />
      </PageBody>
    </>
  );
}
