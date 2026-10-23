import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UploadIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireManager } from "@/lib/auth";
import { memberNames } from "@/lib/inspection-data";
import { createClient } from "@/lib/supabase/server";
import { ImportHistory } from "./import-history";
import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("import");
  return { title: t("title") };
}

/** Import from Excel or CSV, and the company's past imports. Owners and admins only. */
export default async function ImportPage() {
  const active = await requireManager();
  if (!active) redirect("/");
  const t = await getTranslations("import");
  const tCustomers = await getTranslations("customers");
  const tone = appIcon("customers").tone;

  const supabase = await createClient();
  const [{ data: imports }, names] = await Promise.all([
    supabase
      .from("imports")
      .select("*")
      .eq("organization_id", active.organization.id)
      .order("created_at", { ascending: false })
      .limit(30),
    memberNames(active.organization.id),
  ]);

  return (
    <>
      <PageHeader
        icon={UploadIcon}
        iconClassName={tone}
        title={t("title")}
        breadcrumbs={[{ label: tCustomers("title"), href: "/customers" }]}
      />
      <PageBody width="wide">
        <div className="space-y-2.5 sm:space-y-[15px]">
          <p className="max-w-3xl text-ui text-muted-foreground">{t("description")}</p>
          <ImportWizard />
          <ImportHistory
            items={(imports ?? []).map((item) => ({
              id: item.id,
              fileName: item.file_name,
              createdAt: item.created_at,
              by: item.created_by ? (names.get(item.created_by) ?? null) : null,
              customers: item.customers_created,
              sites: item.sites_created,
              devices: item.devices_created,
              undoneAt: item.undone_at,
            }))}
          />
        </div>
      </PageBody>
    </>
  );
}
