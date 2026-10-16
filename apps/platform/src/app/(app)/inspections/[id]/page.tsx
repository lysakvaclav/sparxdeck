import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { DefectRef, DefectStatusBadge, SeverityBadge } from "@/components/app/defect-badges";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { DetailList } from "@/components/app/detail-list";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
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
import { requireMembership } from "@/lib/auth";
import { formatLabel } from "@/lib/devices";
import { serverEnv } from "@/lib/env";
import { getInspection, loadInspectionRun, memberNames } from "@/lib/inspection-data";
import type { CheckOutcome } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { InspectionRun } from "./inspection-run";
import { ProtocolCard } from "./protocol-card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inspection = await getInspection((await params).id);
  const t = await getTranslations("inspections");
  return { title: inspection?.site ? `${t("title")}: ${inspection.site.name}` : t("title") };
}

const OUTCOME_BADGE: Record<CheckOutcome, "success" | "danger" | "default"> = {
  passed: "success",
  failed: "danger",
  not_checked: "default",
};

export default async function InspectionPage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const inspection = await getInspection(id);
  if (!inspection) notFound();
  const t = await getTranslations("inspections");
  const app = appIcon("inspections");
  const site = inspection.site;
  const completed = inspection.status === "completed";

  const header = (
    <PageHeader
      icon={app.icon}
      iconClassName={app.tone}
      title={site?.name ?? t("title")}
      meta={
        <Badge variant={completed ? "success" : "primaryMinimal"}>
          {t(`status.${inspection.status}`)}
        </Badge>
      }
      breadcrumbs={[
        { label: t("title"), href: "/inspections" },
        ...(site?.customer
          ? [{ label: site.customer.name, href: `/customers/${site.customer.id}` }]
          : []),
      ]}
    />
  );

  if (!completed) {
    const run = await loadInspectionRun(inspection, membership.user_id);
    return (
      <>
        {header}
        <PageBody width="medium">
          <InspectionRun
            inspectionId={inspection.id}
            accessNotes={site?.access_notes ?? null}
            devices={run.devices}
            checks={run.checks}
            appUrl={serverEnv().NEXT_PUBLIC_APP_URL}
          />
        </PageBody>
      </>
    );
  }

  // Completed: the record of what was found, device by device.
  const format = await getFormatter();
  const tDevices = await getTranslations("devices");
  const tDefects = await getTranslations("defects");
  const supabase = await createClient();
  const defectColumns =
    "id, number, description, severity, status, device:devices(label_number, type:device_types(name))";
  const [items, names, { data: created }, { data: observed }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("inspection_items")
        .select(
          "id, device_id, outcome, checked_by, checked_at, notes, device:devices(label_number, location:locations(name, sort_order), type:device_types(name))",
        )
        .eq("inspection_id", inspection.id)
        .order("id")
        .range(from, to),
    ),
    memberNames(inspection.organization_id),
    supabase
      .from("defects")
      .select(defectColumns)
      .eq("inspection_id", inspection.id)
      .order("number"),
    supabase
      .from("defect_events")
      .select(`defect:defects(${defectColumns})`)
      .eq("inspection_id", inspection.id)
      .eq("kind", "observed"),
  ]);
  // Defects found by this inspection: new ones, then open ones it found again.
  const defects = [
    ...(created ?? []).map((defect) => ({ ...defect, again: false })),
    ...(observed ?? []).flatMap((event) =>
      event.defect ? [{ ...event.defect, again: true }] : [],
    ),
  ];
  items.sort(
    (a, b) =>
      (a.device?.location?.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.device?.location?.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      (a.device?.label_number ?? 0) - (b.device?.label_number ?? 0),
  );
  const count = (outcome: CheckOutcome) => items.filter((item) => item.outcome === outcome).length;
  const time = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : null;
  const name = (user: string | null) => (user ? (names.get(user) ?? null) : null);
  const DeviceIcon = OBJECT_TYPES.device.icon;

  return (
    <>
      {header}
      <PageBody>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="contents lg:block lg:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("result.results")}{" "}
                  <span className="font-normal text-muted-foreground">({items.length})</span>
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>{tDevices("columns.label")}</TableHeaderCell>
                    <TableHeaderCell className="hidden sm:table-cell">
                      {tDevices("columns.type")}
                    </TableHeaderCell>
                    <TableHeaderCell className="hidden md:table-cell">
                      {tDevices("columns.location")}
                    </TableHeaderCell>
                    <TableHeaderCell className="text-end">{t("columns.results")}</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="w-full max-w-0 sm:w-auto sm:max-w-none">
                        <span className="flex min-w-0 items-center gap-2">
                          <DeviceIcon className={OBJECT_TYPES.device.text} />
                          <span className="min-w-0">
                            <RowLink
                              href={`/inspections/${inspection.id}/check/${item.device_id}`}
                              className="block font-mono tabular-nums"
                            >
                              {formatLabel(item.device?.label_number ?? 0)}
                            </RowLink>
                            <span className="block truncate text-ui-sm text-muted-foreground sm:hidden">
                              {item.device?.type?.name}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {item.device?.type?.name}
                      </TableCell>
                      <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                        {item.device?.location?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-end whitespace-nowrap">
                        {item.outcome && (
                          <Badge variant={OUTCOME_BADGE[item.outcome]}>
                            {t(`outcome.${item.outcome}`)}
                          </Badge>
                        )}
                        {item.checked_at && (
                          <span className="ms-2 hidden text-ui-sm text-muted-foreground lg:inline">
                            {name(item.checked_by)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            {defects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("result.defects")}{" "}
                    <span className="font-normal text-muted-foreground">({defects.length})</span>
                  </CardTitle>
                </CardHeader>
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeaderCell className="w-24">
                        {tDefects("columns.number")}
                      </TableHeaderCell>
                      <TableHeaderCell>{tDefects("columns.description")}</TableHeaderCell>
                      <TableHeaderCell className="hidden md:table-cell">
                        {tDefects("columns.device")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden sm:table-cell">
                        {tDefects("columns.severity")}
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden sm:table-cell">
                        {tDefects("columns.status")}
                      </TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {defects.map((defect) => (
                      <TableRow key={defect.id}>
                        <TableCell className="whitespace-nowrap">
                          <RowLink href={`/defects/${defect.id}`}>
                            <DefectRef number={defect.number} />
                          </RowLink>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <span className="line-clamp-2 break-words">{defect.description}</span>
                          {defect.again && (
                            <span className="block text-ui-sm text-muted-foreground">
                              {tDefects("events.observed")}
                            </span>
                          )}
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                            <SeverityBadge severity={defect.severity} />
                            <DefectStatusBadge status={defect.status} />
                            <span className="font-mono text-ui-sm text-muted-foreground tabular-nums">
                              {formatLabel(defect.device?.label_number ?? 0)}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap md:table-cell">
                          <span className="font-mono tabular-nums">
                            {formatLabel(defect.device?.label_number ?? 0)}
                          </span>{" "}
                          <span className="text-muted-foreground">{defect.device?.type?.name}</span>
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap sm:table-cell">
                          <SeverityBadge severity={defect.severity} />
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap sm:table-cell">
                          <DefectStatusBadge status={defect.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>

          <div className="contents lg:block lg:space-y-[15px]">
            <ProtocolCard
              inspectionId={inspection.id}
              organizationId={inspection.organization_id}
              customerEmail={inspection.site?.customer?.email ?? null}
              className="max-lg:order-first"
            />
            <Card>
              <CardHeader>
                <CardTitle>{t("result.summary")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 pb-0">
                {(["passed", "failed", "not_checked"] as const).map((outcome) => (
                  <div key={outcome} className="rounded-md bg-muted p-2.5 text-center">
                    <p
                      className={
                        outcome === "passed"
                          ? "text-[24px] font-semibold text-success-text"
                          : outcome === "failed"
                            ? "text-[24px] font-semibold text-destructive-text"
                            : "text-[24px] font-semibold"
                      }
                    >
                      {count(outcome)}
                    </p>
                    <p className="text-ui-sm text-muted-foreground">{t(`outcome.${outcome}`)}</p>
                  </div>
                ))}
              </CardContent>
              <DetailList
                className="mt-2.5"
                items={[
                  {
                    label: t("result.startedAt"),
                    value: [time(inspection.started_at), name(inspection.started_by)]
                      .filter(Boolean)
                      .join(" · "),
                  },
                  {
                    label: t("result.completedAt"),
                    value: [time(inspection.completed_at), name(inspection.completed_by)]
                      .filter(Boolean)
                      .join(" · "),
                  },
                  {
                    label: t("columns.site"),
                    value: site && (
                      <Link href={`/sites/${site.id}`} className="text-link hover:underline">
                        {site.name}
                      </Link>
                    ),
                  },
                ]}
              />
            </Card>
            {inspection.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("result.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="break-words whitespace-pre-line">{inspection.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
