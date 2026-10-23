import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddIcon, CubeIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deviceTypes");
  return { title: t("title") };
}

export default async function DeviceTypesPage() {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("deviceTypes");
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("device_types")
    .select(
      "id, code, name, inspection_interval_months, is_sample, checklist_templates(id, name, version, is_sample, active, checklist_template_items(count))",
    )
    .eq("organization_id", organization.id)
    .eq("checklist_templates.active", true)
    .order("name");

  const app = appIcon("deviceTypes");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          manager && (
            <Button asChild>
              <Link href="/device-types/new">
                <AddIcon />
                {t("newType")}
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        {!manager && <Alert className="mb-5">{t("readOnly")}</Alert>}
        <Card>
          {types && types.length > 0 ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>{t("columns.name")}</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">
                    {t("columns.code")}
                  </TableHeaderCell>
                  <TableHeaderCell>{t("columns.interval")}</TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">
                    {t("columns.template")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden text-end lg:table-cell">
                    {t("columns.items")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">
                    {t("columns.state")}
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {types.map((type) => {
                  const template = type.checklist_templates[0];
                  const sample = type.is_sample || template?.is_sample;
                  return (
                    <TableRow key={type.id}>
                      <TableCell className="w-full max-w-0 sm:w-[28%]">
                        <span className="flex min-w-0 items-center gap-2">
                          <CubeIcon className={app.tone} />
                          <RowLink href={`/device-types/${type.id}`} className="truncate">
                            {type.name}
                          </RowLink>
                        </span>
                      </TableCell>
                      <TableCell className="hidden font-mono text-ui-sm text-muted-foreground md:table-cell">
                        {type.code}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {t("months", { count: type.inspection_interval_months })}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {template ? (
                          <>
                            {template.name}{" "}
                            <span className="text-muted-foreground">
                              · {t("detail.version", { version: template.version })}
                            </span>
                          </>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-end tabular-nums lg:table-cell">
                        {template?.checklist_template_items[0]?.count ?? 0}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        <Badge variant={sample ? "warning" : "success"}>
                          {sample ? t("sample") : t("verified")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={CubeIcon} title={t("empty")} />
          )}
        </Card>
      </PageBody>
    </>
  );
}
