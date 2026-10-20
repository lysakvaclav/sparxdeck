import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  DataLineageIcon,
  EditIcon,
  FormIcon,
  PrintIcon,
  TickCircleIcon,
  TimeIcon,
  WarningSignIcon,
  type IconComponent,
} from "@/components/icons";
import { DefectsCard } from "@/components/app/defects-card";
import { DeleteButton } from "@/components/app/delete-button";
import { StatusBadge } from "@/components/app/device-badges";
import { DetailList } from "@/components/app/detail-list";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { QrCode } from "@/components/app/qr-code";
import { ShareButton } from "@/components/app/share-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isManager, requireMembership } from "@/lib/auth";
import { deviceName, deviceTypeFields, formatLabel, readAttributes } from "@/lib/devices";
import {
  CALENDAR_FORMAT,
  calendarDate,
  daysBetween,
  dueState,
  todayInTimeZone,
  type DueState,
} from "@/lib/due";
import { serverEnv } from "@/lib/env";
import { labelUrl } from "@/lib/qr";
import { openInspectionOf } from "@/lib/inspection-data";
import { getDevice } from "@/lib/records";
import { cn } from "@/lib/utils";
import { StartInspectionButton } from "../../inspections/start-button";
import { deleteDevice } from "../actions";
import { DeviceHistoryCard } from "./history-card";
import { DevicePhotosCard } from "./photos-card";
import { DevicePlanCard } from "./plan-card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const device = await getDevice((await params).id);
  return { title: device ? deviceName(device.type?.name ?? "", device.label_number) : undefined };
}

const CALLOUT: Record<
  DueState,
  { variant: "error" | "warning" | "success" | "neutral"; icon: IconComponent }
> = {
  overdue: { variant: "error", icon: WarningSignIcon },
  soon: { variant: "warning", icon: TimeIcon },
  ok: { variant: "success", icon: TickCircleIcon },
  never: { variant: "neutral", icon: TimeIcon },
};

export default async function DevicePage({ params }: Props) {
  const { id } = await params;
  const { membership, organization } = await requireMembership();
  const device = await getDevice(id);
  if (!device) notFound();
  const t = await getTranslations("devices");
  const tForm = await getTranslations("devices.form");
  const tTypes = await getTranslations("deviceTypes");
  const tCustomers = await getTranslations("customers");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const tLabels = await getTranslations("labels");
  const tInspections = await getTranslations("inspections");
  const openInspection = device.site ? await openInspectionOf(device.site.id) : null;
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const today = todayInTimeZone(organization.timezone);
  const state = dueState(device.next_due_on, today, organization.due_soon_days);
  const active = device.status === "active";
  const inactive = device.status === "active" ? null : device.status;
  const day = (value: string | null) =>
    value ? format.dateTime(calendarDate(value), CALENDAR_FORMAT) : null;
  const typeFields = deviceTypeFields(device.type?.custom_fields);
  const attributes = readAttributes(device.attributes, typeFields);
  const site = device.site;
  const customer = site?.customer;
  const typeName = device.type?.name ?? "";
  const label = formatLabel(device.label_number);
  const qrUrl = labelUrl(serverEnv().NEXT_PUBLIC_APP_URL, device.public_token);
  const callout = CALLOUT[state];
  const days = device.next_due_on ? daysBetween(today, device.next_due_on) : 0;
  const relative =
    state === "overdue" ? t("overdueBy", { days: -days }) : t("dueIn", { days: Math.max(days, 0) });
  const lifeState = device.end_of_life_on
    ? dueState(device.end_of_life_on, today, organization.due_soon_days)
    : "never";
  const link = "text-link hover:underline";

  return (
    <>
      <PageHeader
        icon={OBJECT_TYPES.device.icon}
        iconClassName={OBJECT_TYPES.device.text}
        title={deviceName(typeName, device.label_number)}
        meta={
          <>
            <Badge>{t("type")}</Badge>
            <StatusBadge status={device.status} />
          </>
        }
        breadcrumbs={[
          { label: tCustomers("title"), href: "/customers" },
          ...(customer ? [{ label: customer.name, href: `/customers/${customer.id}` }] : []),
          ...(site ? [{ label: site.name, href: `/sites/${site.id}` }] : []),
        ]}
        actions={
          <>
            {site &&
              active &&
              (openInspection ? (
                <Button asChild>
                  <Link href={`/inspections/${openInspection}/check/${device.id}`}>
                    <FormIcon />
                    {tInspections("device.check")}
                  </Link>
                </Button>
              ) : (
                <StartInspectionButton
                  siteId={site.id}
                  deviceId={device.id}
                  label={tInspections("device.check")}
                />
              ))}
            <ShareButton />
            <Button asChild variant="outline">
              <Link href={`/graph?focus=${device.id}`}>
                <DataLineageIcon />
                {tNav("graph")}
              </Link>
            </Button>
            {manager && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/devices/${device.id}/edit`}>
                    <EditIcon />
                    {tCommon("edit")}
                  </Link>
                </Button>
                <DeleteButton
                  title={t("detail.deleteTitle")}
                  description={t("detail.deleteBody")}
                  action={deleteDevice.bind(null, device.id)}
                  redirectTo={site ? `/sites/${site.id}` : "/devices"}
                />
              </>
            )}
          </>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-2.5 sm:space-y-[15px]">
            {!inactive ? (
              <Alert
                variant={callout.variant}
                icon={callout.icon}
                title={t(`detail.${state === "never" ? "noInspection" : state}Title`)}
              >
                {state === "never" ? (
                  t("detail.noInspectionBody")
                ) : (
                  <>
                    {t(`detail.${state}Body`, { date: day(device.next_due_on)! })}{" "}
                    {state !== "ok" && <span className="font-semibold">({relative})</span>}
                  </>
                )}
              </Alert>
            ) : (
              <Alert variant="neutral" icon={TimeIcon} title={t(`status.${inactive}`)}>
                {t(`detail.inactive.${inactive}`)}
              </Alert>
            )}

            {(lifeState === "overdue" || lifeState === "soon") && (
              <Alert
                variant={lifeState === "overdue" ? "error" : "warning"}
                icon={WarningSignIcon}
                title={t(`detail.endOfLife${lifeState === "overdue" ? "Overdue" : "Soon"}Title`)}
              >
                {t("detail.endOfLifeBody", { date: day(device.end_of_life_on)! })}
              </Alert>
            )}

            <DefectsCard scope={{ device: device.id }} label={device.label_number} />

            <Card>
              <CardHeader>
                <CardTitle>{t("detail.schedule")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("detail.nextDue"),
                    value: active && device.next_due_on && (
                      <span className="tabular-nums">
                        {day(device.next_due_on)}{" "}
                        <span className="text-muted-foreground">· {relative}</span>
                      </span>
                    ),
                  },
                  {
                    label: t("detail.lastInspection"),
                    value: day(device.last_inspection_on),
                  },
                  {
                    label: t("detail.interval"),
                    value: device.type && (
                      <Link href={`/device-types/${device.type.id}`} className={link}>
                        {tTypes("months", { count: device.type.inspection_interval_months })}
                      </Link>
                    ),
                  },
                  {
                    label: tForm("status"),
                    value: <StatusBadge status={device.status} showActive />,
                  },
                ]}
              />
            </Card>

            <DeviceHistoryCard deviceId={device.id} organizationId={organization.id} />

            <Card>
              <CardHeader>
                <CardTitle>{tForm("details")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("detail.type"),
                    value: device.type && (
                      <Link href={`/device-types/${device.type.id}`} className={link}>
                        {typeName}
                      </Link>
                    ),
                  },
                  {
                    label: tForm("serial"),
                    value: device.serial_number && (
                      <span className="font-mono text-ui-sm">{device.serial_number}</span>
                    ),
                  },
                  { label: tForm("manufacturer"), value: device.manufacturer },
                  { label: tForm("model"), value: device.model },
                  // The type's own fields.
                  ...typeFields.map((field) => ({
                    label: field.label,
                    value: attributes[field.key],
                  })),
                  {
                    label: tForm("manufactureYear"),
                    value: device.manufacture_year && String(device.manufacture_year),
                  },
                  { label: tForm("installedOn"), value: day(device.installed_on) },
                  {
                    label: tForm("endOfLifeOn"),
                    value: device.end_of_life_on && (
                      <span
                        className={cn(
                          "tabular-nums",
                          lifeState === "overdue" && "font-semibold text-destructive-text",
                          lifeState === "soon" && "font-semibold text-warning-text",
                        )}
                      >
                        {day(device.end_of_life_on)}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>

            <DevicePhotosCard deviceId={device.id} organizationId={organization.id} />
          </div>

          <div className="space-y-2.5 sm:space-y-[15px]">
            <Card>
              <CardHeader>
                <CardTitle>{tLabels("card.title")}</CardTitle>
              </CardHeader>
              <div className="flex gap-[15px] p-[15px]">
                <QrCode
                  value={qrUrl}
                  label={tLabels("card.qr", { label })}
                  className="size-[120px] shrink-0 rounded-sm shadow-[0_0_0_1px_var(--border)]"
                />
                <div className="flex min-w-0 flex-col items-start gap-2.5">
                  <div>
                    <p className="text-ui-sm text-muted-foreground">{t("detail.label")}</p>
                    <p className="font-mono text-[28px] leading-8 font-semibold tabular-nums">
                      {label}
                    </p>
                  </div>
                  {site && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/devices/labels?site=${site.id}&device=${device.id}`}>
                        <PrintIcon />
                        {tLabels("printOne")}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1 px-[15px] pb-[15px]">
                <p className="text-ui-sm text-muted-foreground">{tLabels("card.url")}</p>
                <p className="font-mono text-ui-sm break-all">{qrUrl}</p>
                <p className="text-ui-sm text-muted-foreground">{tLabels("card.hint")}</p>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tForm("placement")}</CardTitle>
              </CardHeader>
              <DetailList
                items={[
                  {
                    label: t("filters.customer"),
                    value: customer && (
                      <Link href={`/customers/${customer.id}`} className={link}>
                        {customer.name}
                      </Link>
                    ),
                  },
                  {
                    label: t("detail.site"),
                    value: site && (
                      <Link href={`/sites/${site.id}`} className={link}>
                        {site.name}
                      </Link>
                    ),
                  },
                  { label: t("detail.location"), value: device.location?.name },
                  {
                    label: t("detail.added"),
                    value: format.dateTime(new Date(device.created_at), { dateStyle: "medium" }),
                  },
                ]}
              />
            </Card>
            {site && active && (
              <DevicePlanCard
                device={{ id: device.id, label, typeName, due: state }}
                siteId={site.id}
                manager={manager}
              />
            )}
            {device.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("detail.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="break-words whitespace-pre-line">{device.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
