import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { getSite } from "@/lib/records";
import { SiteForm } from "../../site-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sites.form");
  return { title: t("editTitle") };
}

export default async function EditSitePage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/sites/${id}`);
  const site = await getSite(id);
  if (!site) notFound();
  const t = await getTranslations("sites.form");
  const tCustomers = await getTranslations("customers");

  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.site.icon}
        iconClassName={OBJECT_TYPES.site.text}
        title={t("editTitle")}
        breadcrumbs={[
          { label: tCustomers("title"), href: "/customers" },
          ...(site.customer
            ? [{ label: site.customer.name, href: `/customers/${site.customer.id}` }]
            : []),
          { label: site.name, href: `/sites/${site.id}` },
        ]}
      />
      <PageBody width="narrow">
        <Card>
          <SiteForm
            mode="edit"
            siteId={site.id}
            defaults={{
              name: site.name,
              address: site.address ?? "",
              accessNotes: site.access_notes ?? "",
              notes: site.notes ?? "",
              coordinates:
                site.latitude !== null && site.longitude !== null
                  ? `${site.latitude}, ${site.longitude}`
                  : "",
              radius: String(site.location_radius_m),
              locationSource: site.location_source ?? undefined,
            }}
          />
        </Card>
      </PageBody>
    </>
  );
}
