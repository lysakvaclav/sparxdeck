import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CubeIcon, EditIcon, HistoryIcon, SmallTickIcon } from "@/components/icons";
import { DetailList } from "@/components/app/detail-list";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { isManager, requireMembership } from "@/lib/auth";
import { getDeviceType } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = await getDeviceType((await params).id);
  return { title: type?.name };
}

export default async function DeviceTypePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const type = await getDeviceType(id);
  if (!type) notFound();
  const t = await getTranslations("deviceTypes");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const [{ data: versions }, { data: members }] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select(
        "id, version, name, is_sample, active, created_by, created_at, checklist_template_items(count)",
      )
      .eq("device_type_id", type.id)
      .order("version", { ascending: false }),
    supabase
      .from("memberships")
      .select("user_id, display_name")
      .eq("organization_id", type.organization_id),
  ]);
  const activeVersion = versions?.find((version) => version.active) ?? versions?.[0];
  const requested = Number((await searchParams).version);
  const shown =
    (Number.isInteger(requested) && versions?.find((version) => version.version === requested)) ||
    activeVersion;

  const { data: items } = shown
    ? await supabase
        .from("checklist_template_items")
        .select("id, sort_order, label, item_type, required, fail_creates_defect, photo_required")
        .eq("template_id", shown.id)
        .order("sort_order")
    : { data: [] };

  const names = new Map((members ?? []).map((member) => [member.user_id, member.display_name]));
  const app = appIcon("deviceTypes");
  const sample = type.is_sample || activeVersion?.is_sample;
  const yes = <SmallTickIcon title={tCommon("yes")} className="text-success-text" />;
  const no = <span className="text-subtle">—</span>;

  return (
    <>
      <PageHeader
        icon={CubeIcon}
        iconClassName={app.tone}
        title={type.name}
        meta={
          <>
            <Badge>{t("type")}</Badge>
            <Badge variant={sample ? "warning" : "success"}>
              {sample ? t("sample") : t("verified")}
            </Badge>
          </>
        }
        breadcrumbs={[{ label: t("title"), href: "/device-types" }]}
        actions={
          manager && (
            <>
              <Button asChild variant="outline">
                <Link href={`/device-types/${type.id}/edit`}>
                  <EditIcon />
                  {t("detail.editType")}
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/device-types/${type.id}/template`}>
                  <EditIcon />
                  {t("detail.editTemplate")}
                </Link>
              </Button>
            </>
          )
        }
      />

      <PageBody>
        {sample && (
          <Alert variant="warning" title={t("sampleTitle")} className="mb-[15px]">
            <p>{t("sampleBody")}</p>
          </Alert>
        )}
        {shown && activeVersion && shown.id !== activeVersion.id && (
          <Alert icon={HistoryIcon} className="mb-[15px]">
            <p>
              {t("detail.olderVersion", { version: shown.version, active: activeVersion.version })}{" "}
              <Link
                href={`/device-types/${type.id}`}
                className="text-link underline-offset-2 hover:underline"
              >
                {t("detail.showActive")}
              </Link>
            </p>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {shown?.name ?? t("detail.template")}{" "}
                {shown && (
                  <span className="font-normal text-muted-foreground">
                    · {t("detail.version", { version: shown.version })}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="w-12 text-end">#</TableHeaderCell>
                  <TableHeaderCell>{t("columns.label")}</TableHeaderCell>
                  <TableHeaderCell className="w-32">{t("columns.answer")}</TableHeaderCell>
                  <TableHeaderCell className="hidden w-24 text-center sm:table-cell">
                    {t("columns.required")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden w-40 text-center sm:table-cell">
                    {t("columns.defect")}
                  </TableHeaderCell>
                  <TableHeaderCell className="hidden w-32 text-center md:table-cell">
                    {t("columns.photo")}
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {(items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-end text-muted-foreground tabular-nums">
                      {item.sort_order}
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="block truncate">{item.label}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge>{t(`itemTypes.${item.item_type}`)}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-center sm:table-cell">
                      <span className="inline-flex justify-center">{item.required ? yes : no}</span>
                    </TableCell>
                    <TableCell className="hidden text-center sm:table-cell">
                      <span className="inline-flex justify-center">
                        {item.fail_creates_defect ? yes : no}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-center md:table-cell">
                      <span className="inline-flex justify-center">
                        {item.photo_required ? yes : no}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-2.5 sm:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>{t("detail.properties")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("columns.code"),
                    value: <span className="font-mono text-ui-sm">{type.code}</span>,
                  },
                  {
                    label: t("columns.interval"),
                    value: (
                      <>
                        {t("months", { count: type.inspection_interval_months })}
                        {type.is_sample && (
                          <span className="block text-ui-sm text-warning-text">
                            {t("intervalSampleHint")}
                          </span>
                        )}
                      </>
                    ),
                  },
                  {
                    label: t("detail.activeVersion"),
                    value: activeVersion && t("detail.version", { version: activeVersion.version }),
                  },
                  {
                    label: t("detail.updated"),
                    value: format.dateTime(new Date(type.updated_at), { dateStyle: "medium" }),
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t("detail.history")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({versions?.length ?? 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <ul>
                {(versions ?? []).map((version) => {
                  const current = version.id === shown?.id;
                  return (
                    <li key={version.id}>
                      <Link
                        href={
                          version.active
                            ? `/device-types/${type.id}`
                            : `/device-types/${type.id}?version=${version.version}`
                        }
                        aria-current={current ? "true" : undefined}
                        className={cn(
                          "flex items-start gap-2.5 px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)] transition-colors last:shadow-none hover:bg-accent",
                          current && "bg-selected",
                        )}
                      >
                        <HistoryIcon className="mt-px text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">
                              {t("detail.version", { version: version.version })}
                            </span>
                            {version.active && (
                              <Badge variant="primaryMinimal">{t("detail.active")}</Badge>
                            )}
                          </span>
                          {/* Grey text falls below 4.5:1 on the blue of the current row. */}
                          <span
                            className={cn(
                              "block text-ui-sm",
                              current ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {format.dateTime(new Date(version.created_at), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {version.created_by && names.get(version.created_by)
                              ? ` · ${names.get(version.created_by)}`
                              : ""}
                            {" · "}
                            {t("detail.itemCount", {
                              count: version.checklist_template_items[0]?.count ?? 0,
                            })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
