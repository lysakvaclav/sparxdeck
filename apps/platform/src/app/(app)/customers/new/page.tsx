import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { CustomerForm } from "../customer-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customers.form");
  return { title: t("createTitle") };
}

export default async function NewCustomerPage() {
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect("/customers");
  const t = await getTranslations("customers");

  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.customer.icon}
        iconClassName={OBJECT_TYPES.customer.text}
        title={t("form.createTitle")}
        breadcrumbs={[{ label: t("title"), href: "/customers" }]}
      />
      <PageBody width="narrow">
        <Card>
          <CustomerForm />
        </Card>
      </PageBody>
    </>
  );
}
