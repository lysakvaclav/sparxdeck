import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DownloadIcon, PanelTableIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireMembership } from "@/lib/auth";
import { loadSummaryData, readSummaryFilters } from "@/lib/protocol-summary-data";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { SummaryFilters } from "./summary-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inspections.summary");
  return { title: t("title") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A report across many inspections, grouped by building, for a period and an optional customer or building. */
export default async function InspectionSummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { organization } = await requireMembership();
  const params = await searchParams;
  const filters = readSummaryFilters((key) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  }, organization);
  const { customerId, siteId, from, to } = filters;

  const t = await getTranslations("inspections.summary");
  const tInspections = await getTranslations("inspections");
  const app = appIcon("inspections");
  const supabase = await createClient();
  const [data, customers, sites] = await Promise.all([
    loadSummaryData(filters),
    fetchAll((rangeFrom, rangeTo) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(rangeFrom, rangeTo),
    ),
    fetchAll((rangeFrom, rangeTo) =>
      supabase
        .from("sites")
        .select("id, name, customer_id")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .order("name")
        .order("id")
        .range(rangeFrom, rangeTo),
    ),
  ]);

  const pdfHref = `/inspections/summary/pdf?${new URLSearchParams({
    ...(customerId && { customer: customerId }),
    ...(siteId && { site: siteId }),
    from,
    to,
  }).toString()}`;
  const totals = data.buildings.reduce(
    (sum, building) => ({
      inspections: sum.inspections + building.inspections.length,
      defects: sum.defects + building.openDefects.length,
    }),
    { inspections: 0, defects: 0 },
  );

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: tInspections("title"), href: "/inspections" }]}
        actions={
          <Button asChild>
            <a href={pdfHref} data-testid="summary-download">
              <DownloadIcon />
              {t("downloadPdf")}
            </a>
          </Button>
        }
      />
      <PageBody>
        <div className="space-y-2.5 sm:space-y-[15px]">
          <SummaryFilters
            customer={customerId}
            site={siteId}
            from={from}
            to={to}
            customers={customers}
            sites={sites.map((site) => ({ id: site.id, name: site.name, customerId: site.customer_id }))}
          />
          <Card>
            <CardHeader>
              <CardTitle>
                {t("preview", { buildings: data.buildings.length, inspections: totals.inspections, defects: totals.defects })}
              </CardTitle>
            </CardHeader>
            {data.buildings.length === 0 ? (
              <EmptyState icon={PanelTableIcon} title={t("emptyTitle")} description={t("emptyBody")} />
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>{t("columns.site")}</TableHeaderCell>
                    <TableHeaderCell className="hidden sm:table-cell">
                      {t("columns.customer")}
                    </TableHeaderCell>
                    <TableHeaderCell className="text-end">{t("columns.inspections")}</TableHeaderCell>
                    <TableHeaderCell className="text-end">{t("columns.openDefects")}</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.buildings.map((building, index) => (
                    <TableRow key={`${building.siteName}-${index}`}>
                      <TableCell>{building.siteName}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {building.customerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {building.inspections.length}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {building.openDefects.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
