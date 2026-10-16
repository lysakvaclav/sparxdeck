import { NextResponse, type NextRequest } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import sharp from "sharp";
import { getActiveMembership } from "@/lib/auth";
import { CALENDAR_FORMAT, calendarDate, todayInTimeZone } from "@/lib/due";
import { getFloorPlan, planDevices } from "@/lib/floor-plans-data";
import { renderFloorPlanPdf } from "@/lib/pdf/floor-plan";
import { getSite } from "@/lib/records";
import { ORG_ASSETS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Longest side of the plan image in the PDF: sharp on A4 at ~300 dpi. */
const PDF_IMAGE_SIDE = 3200;

function asciiName(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "plan"
  );
}

/**
 * The floor plan as a PDF for printing or for the building's manager: the plan
 * with its devices, then the list of them. Any member may download it; RLS
 * limits plan, building and devices to their organization.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const { id, planId } = await params;
  const active = await getActiveMembership();
  if (!active) return new NextResponse(null, { status: 404 });
  const site = await getSite(id);
  const plan = site ? await getFloorPlan(site.id, planId) : null;
  if (!site || !plan) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: file } = await supabase.storage.from(ORG_ASSETS_BUCKET).download(plan.image_path);
  if (!file) return new NextResponse(null, { status: 404 });
  // react-pdf takes JPEG or PNG; plans are stored as WebP.
  const image = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize(PDF_IMAGE_SIDE, PDF_IMAGE_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const organization = active.organization;
  const today = todayInTimeZone(organization.timezone);
  const devices = (await planDevices(site.id, today, organization.due_soon_days)).filter(
    (device) => device.placement?.planId === plan.id,
  );
  const t = await getTranslations("plans");
  const format = await getFormatter();
  const day = (value: string) => format.dateTime(calendarDate(value), CALENDAR_FORMAT);
  const counts = { overdue: 0, soon: 0, ok: 0, never: 0 };
  for (const device of devices) counts[device.due]++;

  const pdf = await renderFloorPlanPdf({
    title: t("pdf.title"),
    planName: plan.name,
    context: [site.customer?.name, site.name, site.address?.replace(/\s*\n\s*/g, ", ")].filter(
      (part): part is string => Boolean(part),
    ),
    organizationName: organization.name,
    generated: t("pdf.generated", { date: day(today) }),
    image: {
      data: image.data,
      format: "jpg",
      width: image.info.width,
      height: image.info.height,
    },
    markers: devices.map((device) => ({
      x: device.placement!.x,
      y: device.placement!.y,
      label: device.number,
      due: device.due,
    })),
    legend: (["overdue", "soon", "ok", "never"] as const).map((due) => ({
      due,
      label: t(`legend.${due}`),
      count: counts[due],
    })),
    devicesTitle: t("pdf.devices"),
    none: t("pdf.none"),
    columns: {
      label: t("pdf.columns.label"),
      type: t("pdf.columns.type"),
      location: t("pdf.columns.location"),
      nextDue: t("pdf.columns.nextDue"),
      state: t("pdf.columns.state"),
    },
    rows: devices.map((device) => ({
      label: device.number,
      type: device.typeName,
      location: device.locationName ?? "—",
      nextDue: device.nextDue ? day(device.nextDue) : "—",
      state: t(`legend.${device.due}`),
      due: device.due,
    })),
    page: (page, pages) => t("pdf.page", { page, pages }),
  });

  const prefix = (await getLocale()) === "cs" ? "pudorys" : "floor-plan";
  const name = `${prefix}-${asciiName(`${site.name} ${plan.name}`)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
