import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { deviceName } from "@/lib/devices";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import { DefectForm } from "./defect-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("defects");
  return { title: t("newTitle") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Reporting a defect: from a device (?device=) or by its label number. */
export default async function NewDefectPage({ searchParams }: Props) {
  const { organization } = await requireMembership();
  const t = await getTranslations("defects");
  const deviceId = (await searchParams).device;
  let device: { id: string; name: string; siteName: string } | null = null;
  if (typeof deviceId === "string" && idSchema.safeParse(deviceId).success) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("devices")
      .select("id, label_number, type:device_types(name), site:sites(name)")
      .eq("id", deviceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data)
      device = {
        id: data.id,
        name: deviceName(data.type?.name ?? "", data.label_number),
        siteName: data.site?.name ?? "",
      };
  }
  const app = appIcon("defects");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("newTitle")}
        breadcrumbs={[
          { label: t("title"), href: "/defects" },
          ...(device ? [{ label: device.name, href: `/devices/${device.id}` }] : []),
        ]}
      />
      <PageBody width="narrow">
        <Card>
          <DefectForm device={device} organizationId={organization.id} />
        </Card>
      </PageBody>
    </>
  );
}
