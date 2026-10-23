import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AddIcon, DataLineageIcon, EditIcon } from "@/components/icons";
import { DefectsCard } from "@/components/app/defects-card";
import { ProtocolsCard } from "@/components/app/protocols-card";
import { DeleteButton } from "@/components/app/delete-button";
import { DetailList } from "@/components/app/detail-list";
import { EmptyState } from "@/components/app/empty-state";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ShareButton } from "@/components/app/share-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RowLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { getCustomer } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomer } from "../actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const customer = await getCustomer((await params).id);
  return { title: customer?.name };
}

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const t = await getTranslations("customers");
  const tGuide = await getTranslations("guide");
  const tSites = await getTranslations("sites");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, address, access_notes, locations(count), devices(count)")
    .eq("customer_id", customer.id)
    .is("deleted_at", null)
    .is("devices.deleted_at", null)
    .order("name");

  const type = OBJECT_TYPES.customer;
  const SiteIcon = OBJECT_TYPES.site.icon;
  const link = "text-link hover:underline";

  const addSite = manager && (
    <Button asChild variant="outline" size="sm">
      <Link href={`/customers/${customer.id}/sites/new`}>
        <AddIcon />
        {t("detail.addSite")}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={type.icon}
        iconClassName={type.text}
        title={customer.name}
        meta={
          <>
            <Badge>{t("type")}</Badge>
            {customer.is_sample && <Badge variant="warning">{tGuide("sampleBadge")}</Badge>}
            {customer.company_id && (
              <Badge variant="outline" className="font-mono">
                {t("form.companyId")} {customer.company_id}
              </Badge>
            )}
          </>
        }
        breadcrumbs={[{ label: t("title"), href: "/customers" }]}
        actions={
          <>
            <ShareButton />
            <Button asChild variant="outline">
              <Link href={`/graph?focus=${customer.id}`}>
                <DataLineageIcon />
                {tNav("graph")}
              </Link>
            </Button>
            {manager && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/customers/${customer.id}/edit`}>
                    <EditIcon />
                    {tCommon("edit")}
                  </Link>
                </Button>
                <DeleteButton
                  title={t("detail.deleteTitle")}
                  description={t("detail.deleteBody")}
                  action={deleteCustomer.bind(null, customer.id)}
                  redirectTo="/customers"
                />
              </>
            )}
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-3 sm:space-y-5">
            <Card>
              <CardHeader actions={sites && sites.length > 0 ? addSite : undefined}>
                <CardTitle>
                  {t("detail.sites")}{" "}
                  <span className="font-normal text-muted-foreground">({sites?.length ?? 0})</span>
                </CardTitle>
              </CardHeader>
              {sites && sites.length > 0 ? (
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>{tSites("form.name")}</TableHeaderCell>
                      <TableHeaderCell className="hidden sm:table-cell">
                        {tSites("form.address")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden xl:table-cell">
                        {tSites("form.accessNotes")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden text-end sm:table-cell">
                        {tSites("columns.locations")}
                      </TableHeaderCell>
                      <TableHeaderCell className="text-end">
                        {tSites("columns.devices")}
                      </TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="w-full max-w-0 sm:w-[35%]">
                          <span className="flex min-w-0 items-center gap-2">
                            <SiteIcon className={OBJECT_TYPES.site.text} />
                            <span className="min-w-0">
                              <RowLink href={`/sites/${site.id}`} className="block truncate">
                                {site.name}
                              </RowLink>
                              {site.address && (
                                <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                                  {site.address.replaceAll("\n", ", ")}
                                </span>
                              )}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden max-w-0 truncate sm:table-cell">
                          {site.address?.replaceAll("\n", ", ") || (
                            <span className="text-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-0 truncate text-muted-foreground xl:table-cell">
                          {site.access_notes?.replaceAll("\n", " ") || (
                            <span className="text-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-end tabular-nums sm:table-cell">
                          {site.locations[0]?.count ?? 0}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {site.devices[0]?.count || <span className="text-subtle">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={SiteIcon}
                  title={t("detail.noSites")}
                  description={manager ? t("detail.noSitesHint") : undefined}
                  action={addSite}
                />
              )}
            </Card>
            <DefectsCard scope={{ customer: customer.id }} />
            <ProtocolsCard scope={{ customer: customer.id }} />
          </div>

          <div className="space-y-3 sm:space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>{t("detail.properties")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  { label: t("form.contactPerson"), value: customer.contact_person },
                  {
                    label: t("form.email"),
                    value: customer.email && (
                      <a href={`mailto:${customer.email}`} className={link}>
                        {customer.email}
                      </a>
                    ),
                  },
                  {
                    label: t("form.phone"),
                    value: customer.phone && (
                      <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className={link}>
                        {customer.phone}
                      </a>
                    ),
                  },
                  {
                    label: t("form.companyId"),
                    value: customer.company_id && (
                      <span className="font-mono text-ui-sm">{customer.company_id}</span>
                    ),
                  },
                  {
                    label: t("form.vatId"),
                    value: customer.vat_id && (
                      <span className="font-mono text-ui-sm">{customer.vat_id}</span>
                    ),
                  },
                  { label: t("form.billingAddress"), value: customer.billing_address },
                  {
                    label: t("columns.added"),
                    value: format.dateTime(new Date(customer.created_at), { dateStyle: "medium" }),
                  },
                ]}
              />
            </Card>
            {customer.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("detail.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="break-words whitespace-pre-line">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
