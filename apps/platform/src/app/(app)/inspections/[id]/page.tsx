import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { DefectRef, DefectStatusBadge, SeverityBadge } from "@/components/app/defect-badges";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { DetailList } from "@/components/app/detail-list";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ScanLocationBadge } from "@/components/app/scan-location-badge";
import { PrintIcon } from "@/components/icons";
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
import { formatLabel } from "@/lib/devices";
import { serverEnv } from "@/lib/env";
import { scanLocationSummary } from "@/lib/scan-location";
import { loadFieldPack } from "@/lib/field-pack";
import { getInspection, memberNames } from "@/lib/inspection-data";
import type { CheckOutcome } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { FieldApp } from "./field-app";
import { ForgetOffline } from "./forget-offline";
import { ProtocolCard } from "./protocol-card";
import { ReopenInspectionButton } from "./reopen-button";

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

  // In progress: the field app (works without a signal, see FieldApp).
  if (!completed) {
    const pack = await loadFieldPack(inspection, {
      userId: membership.user_id,
      role: membership.role,
    });
    return (
      <FieldApp initialPack={pack} initialDevice={null} appUrl={serverEnv().NEXT_PUBLIC_APP_URL} />
    );
  }

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
      actions={
        isManager(membership.role) ? <ReopenInspectionButton inspectionId={inspection.id} /> : null
      }
    />
  );

  // Completed: the record of what was found, device by device.
  const format = await getFormatter();
  const tDevices = await getTranslations("devices");
  const tDefects = await getTranslations("defects");
  const tLocation = await getTranslations("scanLocation");
  const supabase = await createClient();
  const defectColumns =
    "id, number, description, severity, status, device:devices(label_number, type:device_types(name))";
  const [items, names, { data: created }, { data: observed }, { data: added }, { data: reopenings }] =
    await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("inspection_items")
          .select(
            "id, device_id, outcome, skip_reason, checked_by, original_checked_by, checked_at, notes, location_state, location_note, device:devices(label_number, location:locations(name, sort_order), type:device_types(name))",
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
      supabase
        .from("devices")
        .select("id, label_number, type:device_types(name)")
        .eq("added_in_inspection", inspection.id)
        .is("deleted_at", null)
        .order("label_number"),
      completed
        ? supabase
            .from("inspection_reopenings")
            .select("id, reopened_by, reopened_at, reason, completed_by, completed_at")
            .eq("inspection_id", inspection.id)
            .order("reopened_at", { ascending: false })
        : Promise.resolve({ data: null }),
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
  // The position of scans, when any device was scanned with it recorded.
  const scanned = items.filter((item) => item.location_state !== null);
  const scanSummary = scanLocationSummary(items.map((item) => item.location_state));

  return (
    <>
      {header}
      <PageBody>
        <ForgetOffline inspectionId={inspection.id} />
        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="contents lg:block lg:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("result.results")}{" "}
                  <span className="font-normal text-muted-foreground">({items.length})</span>
                </CardTitle>
                {scanned.length > 0 && (
                  <p className="text-ui-sm text-muted-foreground">
                    {tLocation("summary", {
                      matches: scanSummary.matches,
                      total: scanSummary.total,
                    })}
                  </p>
                )}
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
                            {/* Why a device was left out: the office reads it here. */}
                            {item.skip_reason && item.notes && (
                              <span className="block text-ui-sm break-words whitespace-pre-line text-muted-foreground sm:max-w-72">
                                {item.notes}
                              </span>
                            )}
                            {item.location_state && (
                              <ScanLocationBadge state={item.location_state} className="mt-1" />
                            )}
                            {item.location_note && (
                              <span className="block text-ui-sm break-words text-muted-foreground sm:max-w-72">
                                {item.location_note}
                              </span>
                            )}
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
                            {item.skip_reason
                              ? t(`outcome.${item.skip_reason}`)
                              : t(`outcome.${item.outcome}`)}
                          </Badge>
                        )}
                        {item.checked_at && (
                          <span className="ms-2 hidden text-ui-sm text-muted-foreground lg:inline">
                            {name(item.original_checked_by ?? item.checked_by)}
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
                  ...(inspection.customer_signature_path || inspection.customer_signer_name
                    ? [
                        {
                          label: t("result.signedBy"),
                          value: [
                            inspection.customer_signer_name,
                            time(inspection.customer_signed_at),
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        },
                      ]
                    : []),
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
            {added && added.length > 0 && site && (
              <Card>
                <CardHeader
                  actions={
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/devices/labels?site=${site.id}&${added.map((device) => `device=${device.id}`).join("&")}`}
                      >
                        <PrintIcon />
                        {t("result.printLabels")}
                      </Link>
                    </Button>
                  }
                >
                  <CardTitle>
                    {t("result.added")}{" "}
                    <span className="font-normal text-muted-foreground">({added.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-ui-sm text-muted-foreground">{t("result.addedHint")}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {added.map((device) => (
                      <li key={device.id}>
                        <Link
                          href={`/devices/${device.id}`}
                          className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md surface-button px-2 hover:bg-[var(--btn-bg-hover)] pointer-coarse:min-h-11"
                        >
                          <span className="font-mono tabular-nums">
                            {formatLabel(device.label_number)}
                          </span>
                          <span className="text-ui-sm text-muted-foreground">
                            {device.type?.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {reopenings && reopenings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("reopen.historyTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {reopenings.map((entry) => (
                    <div key={entry.id} className="text-ui-sm">
                      <p className="text-muted-foreground">
                        {t("reopen.historyOpened", {
                          when: [time(entry.reopened_at), name(entry.reopened_by)]
                            .filter(Boolean)
                            .join(" · "),
                        })}
                      </p>
                      <p className="break-words whitespace-pre-line">{entry.reason}</p>
                      {entry.completed_at && (
                        <p className="text-muted-foreground">
                          {t("reopen.historyCompleted", {
                            when: [time(entry.completed_at), name(entry.completed_by)]
                              .filter(Boolean)
                              .join(" · "),
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
