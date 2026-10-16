import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { getActiveMembership } from "@/lib/auth";
import { formatLabel } from "@/lib/devices";
import { serverEnv } from "@/lib/env";
import { CUSTOM_FIELDS, withCopies } from "@/lib/labels";
import { renderLabelsPdf } from "@/lib/pdf/labels";
import { labelUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import { labelPrintSchema, sheetLayoutOf } from "@/lib/validation";

export const runtime = "nodejs";

/** Ids per query: 500 ids in one URL would be too long for the API. */
const ID_CHUNK = 100;

/** The print page's own form only: no other site can make a signed-in browser render labels. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function asciiName(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "labels"
  );
}

/**
 * Labels as a PDF, from the print page's form: selected devices (in the order
 * given), copies, the sheet and the first position. Any member may print; RLS
 * limits the devices to their organization.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const active = await getActiveMembership();
  if (!active) return new NextResponse("Unauthorized", { status: 401 });

  const form = await request.formData();
  const preset = form.get("preset");
  const parsed = labelPrintSchema.safeParse({
    deviceIds: form.getAll("deviceId"),
    copies: form.get("copies"),
    startAt: form.get("startAt"),
    preset,
    custom:
      preset === "custom"
        ? Object.fromEntries(CUSTOM_FIELDS.map((key) => [key, form.get(key) ?? ""]))
        : undefined,
  });
  if (!parsed.success) {
    return new NextResponse(parsed.error.issues[0]?.message ?? "Invalid", { status: 400 });
  }
  const { deviceIds, copies, startAt } = parsed.data;

  const supabase = await createClient();
  const rows: { id: string; label_number: number; public_token: string; siteName: string }[] = [];
  for (let from = 0; from < deviceIds.length; from += ID_CHUNK) {
    const { data, error } = await supabase
      .from("devices")
      .select("id, label_number, public_token, site:sites(name)")
      .in("id", deviceIds.slice(from, from + ID_CHUNK))
      .is("deleted_at", null);
    if (error) return new NextResponse("Error", { status: 500 });
    for (const device of data ?? []) rows.push({ ...device, siteName: device.site?.name ?? "" });
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const devices = deviceIds.flatMap((id) => byId.get(id) ?? []);
  if (devices.length === 0) return new NextResponse("Not found", { status: 404 });

  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL;
  const labels = withCopies(
    devices.map((device) => ({
      number: formatLabel(device.label_number),
      siteName: device.siteName,
      url: labelUrl(appUrl, device.public_token),
    })),
    copies,
  );
  const sites = [...new Set(devices.map((device) => device.siteName))];
  const title = sites.length === 1 ? `${sites[0]}` : active.organization.name;
  const pdf = await renderLabelsPdf({
    labels,
    layout: sheetLayoutOf(parsed.data),
    startAt,
    organizationName: active.organization.name,
    title,
  });

  // The guide's last step: the company has printed labels.
  if (!active.organization.labels_printed_at)
    await supabase.rpc("note_labels_printed", { p_org: active.organization.id });

  const prefix = (await getLocale()) === "cs" ? "stitky" : "labels";
  const file = `${prefix}-${asciiName(title)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
