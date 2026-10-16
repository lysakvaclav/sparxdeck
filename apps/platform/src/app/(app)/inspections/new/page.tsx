import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { getDeviceFormOptions } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { StartForm } from "./start-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspections");
  return { title: t("startTitle") };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewInspectionPage({ searchParams }: Props) {
  const { organization } = await requireMembership();
  const t = await getTranslations("inspections");
  const site = (await searchParams).site;
  const { sites } = await getDeviceFormOptions(organization.id);
  const supabase = await createClient();
  const { data: open } = await supabase
    .from("inspections")
    .select("site_id")
    .eq("organization_id", organization.id)
    .eq("status", "in_progress");
  const running = new Set((open ?? []).map((row) => row.site_id));
  const app = appIcon("inspections");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("startTitle")}
        breadcrumbs={[{ label: t("title"), href: "/inspections" }]}
      />
      <PageBody width="narrow">
        <Card>
          <StartForm
            sites={sites.map(({ id, name, customerId, customerName }) => ({
              id,
              name,
              customerId,
              customerName,
              running: running.has(id),
            }))}
            initialSite={typeof site === "string" && sites.some((s) => s.id === site) ? site : ""}
          />
        </Card>
      </PageBody>
    </>
  );
}
