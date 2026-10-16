import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { getCustomer } from "@/lib/records";
import { SiteForm } from "../../../../sites/site-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sites.form");
  return { title: t("createTitle") };
}

export default async function NewSitePage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/customers/${id}`);
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const t = await getTranslations("sites.form");
  const tCustomers = await getTranslations("customers");

  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.site.icon}
        iconClassName={OBJECT_TYPES.site.text}
        title={t("createTitle")}
        breadcrumbs={[
          { label: tCustomers("title"), href: "/customers" },
          { label: customer.name, href: `/customers/${customer.id}` },
        ]}
      />
      <PageBody width="narrow">
        <Card>
          <SiteForm mode="create" customerId={customer.id} />
        </Card>
      </PageBody>
    </>
  );
}
