import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { DocumentIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { NewTemplateButton } from "./new-template-button";
import { TemplateRowMenu } from "./template-row-menu";

// Protocol templates (part 22): what the company's protocols look like.
// Owners and admins open one in the editor; technicians see which exist.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("protocolTemplates");
  return { title: t("title") };
}

export default async function ProtocolTemplatesPage() {
  const { membership, organization } = await requireMembership();
  const manager = isManager(membership.role);
  const [t, format] = await Promise.all([getTranslations("protocolTemplates"), getFormatter()]);

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("protocol_templates")
    .select("id, name, description, usage, status, is_default, draft_updated_at, updated_at, current_version_id")
    .eq("organization_id", organization.id)
    .order("is_default", { ascending: false })
    .order("status")
    .order("name");
  const versionIds = (templates ?? []).flatMap((row) => (row.current_version_id ? [row.current_version_id] : []));
  const [{ data: versions }, { data: drafts }, { data: assignments }] = await Promise.all([
    versionIds.length
      ? supabase.from("protocol_template_versions").select("id, version").in("id", versionIds)
      : { data: [] },
    supabase
      .from("protocol_templates")
      .select("id")
      .eq("organization_id", organization.id)
      .not("draft", "is", null),
    supabase
      .from("protocol_template_assignments")
      .select("template_id, customer_id")
      .eq("organization_id", organization.id),
  ]);
  const assigned = new Map<string, { customers: number; types: number }>();
  for (const row of assignments ?? []) {
    const counts = assigned.get(row.template_id) ?? { customers: 0, types: 0 };
    if (row.customer_id) counts.customers += 1;
    else counts.types += 1;
    assigned.set(row.template_id, counts);
  }
  const versionOf = new Map((versions ?? []).map((row) => [row.id, row.version]));
  const withDraft = new Set((drafts ?? []).map((row) => row.id));
  const app = appIcon("protocolTemplates");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={t("title")}
        breadcrumbs={[{ label: organization.name, href: "/" }]}
        actions={
          manager && (
            <NewTemplateButton
              sources={(templates ?? [])
                .filter((row) => row.status !== "archived")
                .map((row) => ({ id: row.id, name: row.name }))}
            />
          )
        }
      />
      <PageBody>
        {!manager && <Alert className="mb-[15px]">{t("readOnly")}</Alert>}
        <Card>
          {templates && templates.length > 0 ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>{t("columns.name")}</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">{t("columns.usage")}</TableHeaderCell>
                  <TableHeaderCell>{t("columns.state")}</TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">{t("columns.version")}</TableHeaderCell>
                  <TableHeaderCell className="hidden lg:table-cell">{t("columns.changed")}</TableHeaderCell>
                  {manager && (
                    <TableHeaderCell className="w-12">
                      <span className="sr-only">{t("columns.actions")}</span>
                    </TableHeaderCell>
                  )}
                </tr>
              </TableHead>
              <TableBody>
                {templates.map((row) => {
                  const version = row.current_version_id ? versionOf.get(row.current_version_id) : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="w-full max-w-0 sm:w-[34%]">
                        {manager && row.status !== "archived" ? (
                          <RowLink href={`/protocol-templates/${row.id}`} className="block truncate">
                            {row.name}
                          </RowLink>
                        ) : (
                          <span className="block truncate">{row.name}</span>
                        )}
                        {row.description && (
                          <span className="block truncate text-ui-sm text-muted-foreground">{row.description}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t(`usage.${row.usage}`)}
                        {assigned.has(row.id) && (
                          <span className="block text-ui-sm text-muted-foreground">
                            {t("assignedTo", {
                              customers: assigned.get(row.id)!.customers,
                              types: assigned.get(row.id)!.types,
                            })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          <Badge variant={row.status === "published" ? "success" : row.status === "draft" ? "warning" : "outline"}>
                            {t(`status.${row.status}`)}
                          </Badge>
                          {row.is_default && <Badge variant="primary">{t("default")}</Badge>}
                          {withDraft.has(row.id) && row.status === "published" && (
                            <Badge variant="outline">{t("hasDraft")}</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                        {version ? t("version", { version }) : "—"}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        {format.dateTime(new Date(row.draft_updated_at ?? row.updated_at), { dateStyle: "medium" })}
                      </TableCell>
                      {manager && (
                        <TableCell>
                          {/* Above the row's link, which covers the row. */}
                          <div className="relative z-10">
                            <TemplateRowMenu id={row.id} name={row.name} status={row.status} isDefault={row.is_default} />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={DocumentIcon} title={t("empty")} />
          )}
        </Card>
      </PageBody>
    </>
  );
}
