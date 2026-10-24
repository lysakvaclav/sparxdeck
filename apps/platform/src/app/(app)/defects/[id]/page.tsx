import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  AnnotationIcon,
  CalendarIcon,
  EditIcon,
  IssueClosedIcon,
  IssueIcon,
  PersonIcon,
  PlayIcon,
  SearchIcon,
  TimeIcon,
  UndoIcon,
  WarningSignIcon,
  type IconComponent,
} from "@/components/icons";
import { DefectStatusBadge, SeverityBadge } from "@/components/app/defect-badges";
import { DetailList } from "@/components/app/detail-list";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ShareButton } from "@/components/app/share-button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth";
import { defectDueState, defectNumber } from "@/lib/defects";
import { deviceName } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate, todayInTimeZone } from "@/lib/due";
import { memberNames } from "@/lib/inspection-data";
import { ORG_ASSETS_BUCKET, SIGNED_URL_SECONDS } from "@/lib/storage";
import type { DefectEventKind } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import {
  AddDefectPhoto,
  CommentForm,
  DefectAssignment,
  DefectStatusControls,
  DescriptionEditor,
} from "./defect-controls";

type Props = { params: Promise<{ id: string }> };

async function loadDefect(id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("defects")
    .select(
      "*, device:devices(id, label_number, type:device_types(name), location:locations(name), site:sites(id, name, customer:customers(id, name))), inspection:inspections(id, started_at, completed_at)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const defect = await loadDefect((await params).id);
  const t = await getTranslations("defects");
  return {
    title: defect ? t("number", { number: defectNumber(defect.number) }) : t("title"),
  };
}

const EVENT_ICON: Record<DefectEventKind, IconComponent> = {
  created: IssueIcon,
  status: IssueClosedIcon,
  severity: WarningSignIcon,
  description: EditIcon,
  comment: AnnotationIcon,
  observed: SearchIcon,
  assignee: PersonIcon,
  due: CalendarIcon,
};

const STATUS_ICON: Record<string, IconComponent> = {
  open: UndoIcon,
  in_progress: PlayIcon,
  resolved: IssueClosedIcon,
};

/** One defect: what's wrong, photos, its history, and the controls to move it along. */
export default async function DefectPage({ params }: Props) {
  const { id } = await params;
  const { organization } = await requireMembership();
  const defect = await loadDefect(id);
  if (!defect) notFound();
  const t = await getTranslations("defects");
  const format = await getFormatter();
  const supabase = await createClient();

  const [{ data: events }, { data: photos }, { data: inspectionPhotos }, names] = await Promise.all(
    [
      supabase
        .from("defect_events")
        .select("id, kind, actor, from_value, to_value, note, inspection_id, created_at")
        .eq("defect_id", id)
        .order("created_at"),
      supabase
        .from("defect_photos")
        .select("id, storage_path")
        .eq("defect_id", id)
        .order("created_at"),
      defect.inspection_item_id
        ? supabase
            .from("inspection_photos")
            .select("id, storage_path, template_item_id")
            .eq("item_id", defect.inspection_item_id)
            .order("created_at")
        : Promise.resolve({
            data: [] as { id: string; storage_path: string; template_item_id: string | null }[],
          }),
      memberNames(organization.id),
    ],
  );
  // Photos of the failed question (or of the whole device) from the inspection.
  const fromInspection = (inspectionPhotos ?? []).filter(
    (photo) =>
      photo.template_item_id === defect.template_item_id || photo.template_item_id === null,
  );
  const paths = [...(photos ?? []), ...fromInspection].map((photo) => photo.storage_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from(ORG_ASSETS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    : { data: [] };
  const urlOf = (path: string) => signed?.find((entry) => entry.path === path)?.signedUrl ?? "";

  const device = defect.device;
  const site = device?.site;
  const ref = t("number", { number: defectNumber(defect.number) });
  const name = (user: string | null) => (user && names.get(user)) || t("events.someone");
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const statusLabel = (value: string | null) =>
    value ? t(`status.${value as "open" | "in_progress" | "resolved"}`) : "";
  const day = (value: string) => format.dateTime(calendarDate(value), CALENDAR_FORMAT);
  const dueState = defectDueState(
    defect.due_on,
    defect.status,
    todayInTimeZone(organization.timezone),
  );
  const severityLabel = (value: string | null) =>
    value ? t(`severity.${value as "minor" | "major" | "critical"}`) : "";
  const eventText = (event: NonNullable<typeof events>[number]) => {
    const actor = name(event.actor);
    switch (event.kind) {
      case "created":
        return event.inspection_id
          ? t("events.createdInInspection", { actor, severity: severityLabel(event.to_value) })
          : t("events.created", { actor, severity: severityLabel(event.to_value) });
      case "status":
        return t("events.status", {
          actor,
          from: statusLabel(event.from_value),
          to: statusLabel(event.to_value),
        });
      case "severity":
        return t("events.severity", {
          actor,
          from: severityLabel(event.from_value),
          to: severityLabel(event.to_value),
        });
      case "description":
        return t("events.description", { actor });
      case "comment":
        return t("events.comment", { actor });
      case "observed":
        return t("events.observed");
      case "assignee":
        return event.to_value
          ? t("events.assigned", { actor, name: name(event.to_value) })
          : t("events.unassigned", { actor });
      case "due":
        return event.to_value
          ? t("events.due", { actor, date: day(event.to_value) })
          : t("events.dueCleared", { actor });
    }
  };
  const gallery = (list: { id: string; storage_path: string }[]) => (
    <ul className="flex flex-wrap gap-2">
      {list.map((photo, index) => (
        <li key={photo.id}>
          <a href={urlOf(photo.storage_path)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
            <img
              src={urlOf(photo.storage_path)}
              alt={`${ref} · ${index + 1}`}
              className="size-24 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
            />
          </a>
        </li>
      ))}
    </ul>
  );
  const app = appIcon("defects");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={ref}
        meta={
          <>
            <SeverityBadge severity={defect.severity} />
            <DefectStatusBadge status={defect.status} />
          </>
        }
        breadcrumbs={[
          { label: t("title"), href: "/defects" },
          ...(device
            ? [
                {
                  label: deviceName(device.type?.name ?? "", device.label_number),
                  href: `/devices/${device.id}`,
                },
              ]
            : []),
        ]}
        actions={<ShareButton />}
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="contents lg:block lg:space-y-[15px]">
            {defect.due_on && (dueState === "overdue" || dueState === "soon") && (
              <Alert
                variant={dueState === "overdue" ? "error" : "warning"}
                icon={dueState === "overdue" ? WarningSignIcon : TimeIcon}
                title={t(dueState === "overdue" ? "detail.dueOverdueTitle" : "detail.dueSoonTitle")}
                className="max-lg:order-1"
              >
                {t("detail.dueBody", { date: day(defect.due_on) })}
              </Alert>
            )}
            {defect.status === "resolved" && defect.resolution_note && (
              <Alert
                variant="success"
                icon={IssueClosedIcon}
                title={t("detail.resolution")}
                className="max-lg:order-1"
              >
                <p className="break-words whitespace-pre-line">{defect.resolution_note}</p>
              </Alert>
            )}
            <Card className="max-lg:order-2">
              <CardHeader>
                <CardTitle>{t("detail.description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <DescriptionEditor
                  key={defect.description}
                  id={defect.id}
                  description={defect.description}
                />
              </CardContent>
            </Card>

            <Card className="max-lg:order-4">
              <CardHeader
                actions={<AddDefectPhoto id={defect.id} organizationId={organization.id} />}
              >
                <CardTitle>
                  {t("detail.photos")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({(photos?.length ?? 0) + fromInspection.length})
                  </span>
                </CardTitle>
              </CardHeader>
              {(photos?.length ?? 0) + fromInspection.length > 0 && (
                <CardContent className="space-y-2.5">
                  {photos && photos.length > 0 && gallery(photos)}
                  {fromInspection.length > 0 && (
                    <>
                      <p className="text-ui-sm text-muted-foreground">
                        {t("detail.photosFromInspection")}
                      </p>
                      {gallery(fromInspection)}
                    </>
                  )}
                </CardContent>
              )}
            </Card>

            <Card className="max-lg:order-5">
              <CardHeader>
                <CardTitle>{t("detail.history")}</CardTitle>
              </CardHeader>
              <ol className="px-[15px] pt-[15px]">
                {(events ?? []).map((event, index, list) => {
                  const Icon =
                    (event.kind === "status" && STATUS_ICON[event.to_value ?? ""]) ||
                    EVENT_ICON[event.kind];
                  return (
                    <li key={event.id} className="relative flex gap-3 pb-[15px]">
                      {index < list.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute start-[11px] top-7 bottom-0 w-px bg-border"
                        />
                      )}
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ui">
                          {eventText(event)}{" "}
                          <span className="text-ui-sm text-muted-foreground">
                            · {time(event.created_at)}
                          </span>
                        </p>
                        {event.note && (
                          <p className="mt-1 rounded-md bg-muted px-2.5 py-1.5 text-ui break-words whitespace-pre-line">
                            {event.note}
                          </p>
                        )}
                        {event.kind === "observed" && event.inspection_id && (
                          <Link
                            href={`/inspections/${event.inspection_id}`}
                            className="text-ui-sm text-link hover:underline"
                          >
                            {t("detail.inspection")}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="px-[15px] pb-[15px]">
                <CommentForm id={defect.id} />
              </div>
            </Card>
          </div>

          <div className="contents lg:block lg:space-y-[15px]">
            <Card className="max-lg:order-3">
              <CardContent>
                <DefectStatusControls
                  id={defect.id}
                  status={defect.status}
                  severity={defect.severity}
                />
              </CardContent>
            </Card>
            {defect.status !== "resolved" && (
              <Card className="max-lg:order-3">
                <CardHeader>
                  <CardTitle>{t("detail.handling")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DefectAssignment
                    key={`${defect.assigned_to}-${defect.due_on}`}
                    id={defect.id}
                    assignedTo={defect.assigned_to}
                    dueOn={defect.due_on}
                    members={[...names].map(([member, display]) => ({ id: member, name: display }))}
                  />
                </CardContent>
              </Card>
            )}
            <Card className="max-lg:order-6">
              <CardHeader>
                <CardTitle>{t("detail.properties")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("detail.device"),
                    value: device && (
                      <Link href={`/devices/${device.id}`} className="text-link hover:underline">
                        {deviceName(device.type?.name ?? "", device.label_number)}
                      </Link>
                    ),
                  },
                  {
                    label: t("detail.site"),
                    value: site && (
                      <Link href={`/sites/${site.id}`} className="text-link hover:underline">
                        {site.name}
                        {device?.location?.name ? ` · ${device.location.name}` : ""}
                      </Link>
                    ),
                  },
                  {
                    label: t("detail.customer"),
                    value: site?.customer && (
                      <Link
                        href={`/customers/${site.customer.id}`}
                        className="text-link hover:underline"
                      >
                        {site.customer.name}
                      </Link>
                    ),
                  },
                  ...(defect.inspection
                    ? [
                        {
                          label: t("detail.inspection"),
                          value: (
                            <Link
                              href={`/inspections/${defect.inspection.id}`}
                              className="text-link hover:underline"
                            >
                              {format.dateTime(
                                new Date(
                                  defect.inspection.completed_at ?? defect.inspection.started_at,
                                ),
                                { dateStyle: "medium" },
                              )}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                  ...(defect.assigned_to
                    ? [{ label: t("detail.assignee"), value: name(defect.assigned_to) }]
                    : []),
                  {
                    label: t("detail.foundAt"),
                    value: `${time(defect.created_at)} · ${name(defect.created_by)}`,
                  },
                  ...(defect.resolved_at
                    ? [
                        {
                          label: t("detail.resolvedAt"),
                          value: `${time(defect.resolved_at)} · ${name(defect.resolved_by)}`,
                        },
                      ]
                    : []),
                ]}
              />
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
