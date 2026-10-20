import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { csvFileName, csvSeparator, toCsv } from "@/lib/csv";
import { deviceListQuery, readDeviceListParams } from "@/lib/device-list";
import { deviceTypeFields, formatLabel, readAttributes, type DeviceTypeField } from "@/lib/devices";
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

  const list = readDeviceListParams(Object.fromEntries(request.nextUrl.searchParams));
  const today = todayInTimeZone(organization.timezone);
  const supabase = await createClient();
  const [devices, { data: types }] = await Promise.all([
    fetchAll((from, to) =>
      deviceListQuery(supabase, organization.id, list, {
        today,
        soonDays: organization.due_soon_days,
      })
        .order("id")
        .range(from, to),
    ),
    supabase.from("device_types").select("custom_fields").eq("organization_id", organization.id),
  ]);

  // Every custom field any of the company's types defines, once each (by key,
  // first label wins): devices of other types leave that column blank.
  const customFields: DeviceTypeField[] = [];
  const seen = new Set<string>();
  for (const type of types ?? [])
    for (const field of deviceTypeFields(type.custom_fields))
      if (!seen.has(field.key)) {
        seen.add(field.key);
        customFields.push(field);
      }

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
    ...customFields.map((field) => field.label),
    t("devices.year"),
    t("devices.installed"),
    t("devices.lastInspection"),
    t("devices.endOfLife"),
    t("devices.nextDue"),
    t("devices.due"),
    t("devices.notes"),
    t("devices.qr"),
  ];
  const rows = devices.map((device) => {
    const attributes = readAttributes(device.attributes, customFields);
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
      ...customFields.map((field) => attributes[field.key]),
      device.manufacture_year,
      device.installed_on,
      device.last_inspection_on,
      device.end_of_life_on,
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
