import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { getCustomer } from "@/lib/records";
import { CustomerForm } from "../../customer-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customers.form");
  return { title: t("editTitle") };
}

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/customers/${id}`);
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const t = await getTranslations("customers");

  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.customer.icon}
        iconClassName={OBJECT_TYPES.customer.text}
        title={t("form.editTitle")}
        breadcrumbs={[
          { label: t("title"), href: "/customers" },
          { label: customer.name, href: `/customers/${customer.id}` },
        ]}
      />
      <PageBody width="narrow">
        <Card>
          <CustomerForm
            customerId={customer.id}
            defaults={{
              name: customer.name,
              companyId: customer.company_id ?? "",
              vatId: customer.vat_id ?? "",
              contactPerson: customer.contact_person ?? "",
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              billingAddress: customer.billing_address ?? "",
              notes: customer.notes ?? "",
            }}
          />
        </Card>
      </PageBody>
    </>
  );
}
