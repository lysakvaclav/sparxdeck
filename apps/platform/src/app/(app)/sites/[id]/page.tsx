import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataLineageIcon, EditIcon, FormIcon, KeyIcon } from "@/components/icons";
import { DefectsCard } from "@/components/app/defects-card";
import { ProtocolsCard } from "@/components/app/protocols-card";
import { DeleteButton } from "@/components/app/delete-button";
import { DetailList } from "@/components/app/detail-list";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ShareButton } from "@/components/app/share-button";
import { SitePlansCard } from "@/components/app/site-plans-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/due";
import { openInspectionOf } from "@/lib/inspection-data";
import { getSite } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { StartInspectionButton } from "../../inspections/start-button";
import { deleteSite } from "../actions";
import { SiteDevicesCard } from "./devices-card";
import { SiteFloorPlansCard } from "./floor-plans-card";
import { Locations } from "./locations";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getSite((await params).id);
  return { title: site?.name };
}

export default async function SitePage({ params }: Props) {
  const { id } = await params;
  const { membership, organization } = await requireMembership();
  const site = await getSite(id);
  if (!site) notFound();
  const t = await getTranslations("sites");
  const tLocations = await getTranslations("locations");
  const tCustomers = await getTranslations("customers");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const tInspections = await getTranslations("inspections");
  const openInspection = await openInspectionOf(site.id);
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("site_id", site.id)
    .order("sort_order")
    .order("created_at");
  const list = locations ?? [];
  const customerHref = site.customer ? `/customers/${site.customer.id}` : "/customers";
  const type = OBJECT_TYPES.site;

  return (
    <>
      <PageHeader
        icon={type.icon}
        iconClassName={type.text}
        title={site.name}
        meta={<Badge>{t("type")}</Badge>}
        breadcrumbs={[
          { label: tCustomers("title"), href: "/customers" },
          ...(site.customer ? [{ label: site.customer.name, href: customerHref }] : []),
        ]}
        actions={
          <>
            {openInspection ? (
              <Button asChild>
                <Link href={`/inspections/${openInspection}`}>
                  <FormIcon />
                  {tInspections("continue")}
                </Link>
              </Button>
            ) : (
              <StartInspectionButton siteId={site.id} />
            )}
            <ShareButton />
            <Button asChild variant="outline">
              <Link href={`/graph?focus=${site.id}`}>
                <DataLineageIcon />
                {tNav("graph")}
              </Link>
            </Button>
            {manager && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/sites/${site.id}/edit`}>
                    <EditIcon />
                    {tCommon("edit")}
                  </Link>
                </Button>
                <DeleteButton
                  title={t("detail.deleteTitle")}
                  description={t("detail.deleteBody")}
                  action={deleteSite.bind(null, site.id)}
                  redirectTo={customerHref}
                />
              </>
            )}
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-2.5 sm:space-y-[15px]">
            {/* What the technician needs at the door, first and impossible to miss. */}
            <Alert
              variant={site.access_notes ? "info" : "neutral"}
              icon={KeyIcon}
              title={t("detail.access")}
            >
              <p className="break-words whitespace-pre-line">
                {site.access_notes ?? t("detail.noAccess")}
              </p>
            </Alert>

            <SiteDevicesCard
              siteId={site.id}
              manager={manager}
              today={todayInTimeZone(organization.timezone)}
              soonDays={organization.due_soon_days}
            />

            <SiteFloorPlansCard siteId={site.id} manager={manager} locations={list} />

            <DefectsCard scope={{ site: site.id }} />

            <ProtocolsCard scope={{ site: site.id }} />

            <Card>
              <CardHeader>
                <CardTitle>
                  {tLocations("title")}{" "}
                  <span className="font-normal text-muted-foreground">({list.length})</span>
                </CardTitle>
                <CardDescription>{tLocations("description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Locations
                  key={list.map((location) => `${location.id}:${location.name}`).join("|")}
                  siteId={site.id}
                  initial={list}
                  editable={manager}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2.5 sm:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>{t("detail.properties")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("detail.customer"),
                    value: site.customer && (
                      <Link href={customerHref} className="text-link hover:underline">
                        {site.customer.name}
                      </Link>
                    ),
                  },
                  { label: t("detail.address"), value: site.address },
                  {
                    label: tCustomers("columns.added"),
                    value: format.dateTime(new Date(site.created_at), { dateStyle: "medium" }),
                  },
                ]}
              />
            </Card>
            <SitePlansCard
              organizationId={organization.id}
              siteId={site.id}
              today={todayInTimeZone(organization.timezone)}
              manager={manager}
            />
            {site.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("detail.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="break-words whitespace-pre-line">{site.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
