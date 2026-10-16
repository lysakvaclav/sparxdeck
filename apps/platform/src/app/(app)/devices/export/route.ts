import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { csvFileName, csvSeparator, toCsv } from "@/lib/csv";
import { deviceListQuery, readDeviceListParams } from "@/lib/device-list";
import { DEVICE_ATTRIBUTES, formatLabel, readAttributes } from "@/lib/devices";
import { dueState, todayInTimeZone } from "@/lib/due";
import { serverEnv } from "@/lib/env";
import { labelUrl } from "@/lib/qr";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * The device list as a CSV file, with the list's search, filters and order
 * (the export button passes the list's URL parameters). Dates are ISO so
 * spreadsheets sort them; texts are in the reader's language.
 */
export async function GET(request: NextRequest) {
  const active = await getActiveMembership();
  if (!active) return new NextResponse(null, { status: 404 });
  const { organization } = active;
  const locale = await getLocale();
  const t = await getTranslations("export");
  const tStatus = await getTranslations("devices.status");
  const tDue = await getTranslations("devices.due");
  const tForm = await getTranslations("devices.form");

  const list = readDeviceListParams(Object.fromEntries(request.nextUrl.searchParams));
  const today = todayInTimeZone(organization.timezone);
  const supabase = await createClient();
  const devices = await fetchAll((from, to) =>
    deviceListQuery(supabase, organization.id, list, {
      today,
      soonDays: organization.due_soon_days,
    })
      .order("id")
      .range(from, to),
  );

  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
  const header = [
    t("devices.label"),
    t("devices.type"),
    t("devices.status"),
    t("devices.customer"),
    t("devices.site"),
    t("devices.location"),
    t("devices.serial"),
    t("devices.manufacturer"),
    t("devices.model"),
    ...DEVICE_ATTRIBUTES.map((key) => tForm(key)),
    t("devices.year"),
    t("devices.installed"),
    t("devices.lastInspection"),
    t("devices.nextDue"),
    t("devices.due"),
    t("devices.notes"),
    t("devices.qr"),
  ];
  const rows = devices.map((device) => {
    const attributes = readAttributes(device.attributes);
    return [
      formatLabel(device.label_number),
      device.type?.name,
      tStatus(device.status),
      device.site.customer?.name,
      device.site.name,
      device.location?.name,
      device.serial_number,
      device.manufacturer,
      device.model,
      ...DEVICE_ATTRIBUTES.map((key) => attributes[key]),
      device.manufacture_year,
      device.installed_on,
      device.last_inspection_on,
      device.next_due_on,
      device.status === "active"
        ? tDue(dueState(device.next_due_on, today, organization.due_soon_days))
        : null,
      device.notes,
      labelUrl(appUrl, device.public_token),
    ];
  });

  const file = toCsv(header, rows, csvSeparator(locale));
  const name = csvFileName(t("devicesFile"), today);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
