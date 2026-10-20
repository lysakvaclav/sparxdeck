import "server-only";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import { renderEmail, sendEmail } from "@/lib/email";
import { memberNames } from "@/lib/inspection-data";
import { renderProtocolPdf, type ProtocolAssets, type ProtocolLogo } from "@/lib/pdf/protocol";
import {
  buildProtocol,
  protocolFileNumber,
  protocolNumber,
  type ProtocolCheck,
  type ProtocolDefect,
  type Translate,
} from "@/lib/protocol";
import { ORG_ASSETS_BUCKET, PROTOCOLS_BUCKET, sniffImage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

// Protocols are read with the user's session (RLS: their company only) and
// written by the service role: the PDF lands in the "protocols" bucket, which no
// app user can write, so a stored protocol never changes.

export type Protocol = Database["public"]["Tables"]["protocols"]["Row"];

/** The inspection's current protocol, if it has one (a past, superseded version isn't it). */
export async function protocolOf(inspectionId: string): Promise<Protocol | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocols")
    .select("*")
    .eq("inspection_id", inspectionId)
    .eq("active", true)
    .maybeSingle();
  return data;
}

/** Every version of the inspection's protocol, newest first (the active one is [0]). */
export async function protocolHistoryOf(inspectionId: string): Promise<Protocol[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocols")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("version", { ascending: false });
  return data ?? [];
}

/** An org-assets image as react-pdf takes it (PNG or JPEG); WebP is converted. Null if unusable. */
async function loadOrgImage(path: string): Promise<ProtocolLogo | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.storage.from(ORG_ASSETS_BUCKET).download(path);
    if (!data) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    const kind = sniffImage(bytes);
    if (kind?.ext === "png") return { data: bytes, format: "png" };
    if (kind?.ext === "jpg") return { data: bytes, format: "jpg" };
    if (kind?.ext === "webp") return { data: await sharp(bytes).png().toBuffer(), format: "png" };
    return null;
  } catch (error) {
    console.error("Protocol image could not be loaded", path, error);
    return null;
  }
}

/**
 * Renders the protocol's PDF from the inspection's records and stores it, unless
 * it already has one. Returns the protocol (with its PDF), or null on failure.
 */
export async function generateProtocol(protocolId: string): Promise<Protocol | null> {
  const supabase = await createClient();
  const { data: protocol } = await supabase
    .from("protocols")
    .select("*")
    .eq("id", protocolId)
    .maybeSingle();
  if (!protocol) return null;
  if (protocol.pdf_path) return protocol;

  try {
    const inspectionId = protocol.inspection_id;
    const [{ data: inspection }, { data: organization }, items, answers, created, observed, names] =
      await Promise.all([
        supabase
          .from("inspections")
          .select(
            "started_at, completed_at, completed_by, notes, customer_signature_path, customer_signer_name, customer_signed_at, site:sites(name, address, customer:customers(name, company_id, vat_id, contact_person, billing_address))",
          )
          .eq("id", inspectionId)
          .single(),
        supabase.from("organizations").select("*").eq("id", protocol.organization_id).single(),
        fetchAll((from, to) =>
          supabase
            .from("inspection_items")
            .select(
              "id, outcome, skip_reason, notes, checked_by, original_checked_by, device:devices(label_number, serial_number, next_due_on, location:locations(name, sort_order), type:device_types(name))",
            )
            .eq("inspection_id", inspectionId)
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("inspection_answers")
            .select(
              "id, item_id, value_pass, value_number, value_text, note, question:checklist_template_items(label, item_type, sort_order), item:inspection_items!inner(inspection_id)",
            )
            .eq("item.inspection_id", inspectionId)
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("defects")
            .select("id, number, description, severity, device:devices(label_number)")
            .eq("inspection_id", inspectionId)
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          supabase
            .from("defect_events")
            .select(
              "id, defect:defects(id, number, description, severity, device:devices(label_number))",
            )
            .eq("inspection_id", inspectionId)
            .eq("kind", "observed")
            .order("id")
            .range(from, to),
        ),
        memberNames(protocol.organization_id),
      ]);
    if (!inspection?.completed_at || !organization) return null;

    const name = (user: string | null) => (user ? (names.get(user) ?? null) : null);
    const answersOf = new Map<string, ProtocolCheck["answers"]>();
    for (const answer of answers) {
      if (!answer.question) continue;
      const list = answersOf.get(answer.item_id) ?? [];
      list.push({
        question: answer.question.label,
        type: answer.question.item_type,
        order: answer.question.sort_order,
        pass: answer.value_pass,
        number: answer.value_number,
        text: answer.value_text,
        note: answer.note,
      });
      answersOf.set(answer.item_id, list);
    }
    const checks: ProtocolCheck[] = items.flatMap((item) =>
      item.device && item.outcome
        ? [
            {
              labelNumber: item.device.label_number,
              typeName: item.device.type?.name ?? "",
              locationName: item.device.location?.name ?? null,
              locationOrder: item.device.location?.sort_order ?? null,
              serialNumber: item.device.serial_number,
              outcome: item.outcome,
              skipReason: item.skip_reason,
              nextDueOn: item.device.next_due_on,
              // A correction keeps the technician who did the check on site.
              checkedBy: name(item.original_checked_by ?? item.checked_by),
              note: item.notes,
              answers: answersOf.get(item.id) ?? [],
            },
          ]
        : [],
    );
    const seen = new Set<string>();
    const defects: ProtocolDefect[] = [];
    const defectIdByNumber = new Map<number, string>();
    for (const [list, again] of [
      [created, false],
      [observed.flatMap((event) => (event.defect ? [event.defect] : [])), true],
    ] as const) {
      for (const defect of list) {
        if (seen.has(defect.id)) continue;
        seen.add(defect.id);
        defectIdByNumber.set(defect.number, defect.id);
        defects.push({
          number: defect.number,
          labelNumber: defect.device?.label_number ?? 0,
          description: defect.description,
          severity: defect.severity,
          again,
        });
      }
    }

    // A few photos per defect, so the protocol stays readable and quick to render.
    const PHOTOS_PER_DEFECT = 2;
    const defectPhotoRows =
      defectIdByNumber.size > 0
        ? await supabase
            .from("defect_photos")
            .select("defect_id, storage_path")
            .in("defect_id", [...defectIdByNumber.values()])
            .order("created_at")
        : { data: [] };
    const photoPathsByDefect = new Map<string, string[]>();
    for (const row of defectPhotoRows.data ?? []) {
      const list = photoPathsByDefect.get(row.defect_id) ?? [];
      if (list.length < PHOTOS_PER_DEFECT) list.push(row.storage_path);
      photoPathsByDefect.set(row.defect_id, list);
    }
    const defectPhotos = new Map<number, ProtocolLogo[]>();
    for (const [number, defectId] of defectIdByNumber) {
      const paths = photoPathsByDefect.get(defectId) ?? [];
      if (paths.length === 0) continue;
      const images = (await Promise.all(paths.map(loadOrgImage))).filter(
        (image): image is ProtocolLogo => image !== null,
      );
      if (images.length > 0) defectPhotos.set(number, images);
    }

    // A reissued protocol says which issue it replaces.
    const previousIssuedAt =
      protocol.version > 1
        ? ((
            await supabase
              .from("protocols")
              .select("generated_at")
              .eq("inspection_id", inspectionId)
              .eq("version", protocol.version - 1)
              .maybeSingle()
          ).data?.generated_at ?? null)
        : null;

    const generatedAt = new Date().toISOString();
    const t = (await getTranslations({
      locale: protocol.locale,
      namespace: "protocol.pdf",
    })) as unknown as Translate;
    const site = inspection.site;
    const customer = site?.customer;
    const model = buildProtocol(
      {
        locale: protocol.locale,
        timeZone: organization.timezone,
        year: protocol.year,
        number: protocol.number,
        numberFormat: protocol.number_format,
        version: protocol.version,
        organization: {
          name: organization.name,
          legalName: organization.legal_name,
          companyId: organization.company_id,
          vatId: organization.vat_id,
          address: organization.address,
          email: organization.email,
          phone: organization.phone,
          footer: organization.protocol_footer_text,
        },
        customer: customer
          ? {
              name: customer.name,
              companyId: customer.company_id,
              vatId: customer.vat_id,
              contactPerson: customer.contact_person,
              billingAddress: customer.billing_address,
            }
          : null,
        site: site ? { name: site.name, address: site.address } : null,
        startedAt: inspection.started_at,
        completedAt: inspection.completed_at,
        generatedAt,
        completedBy: name(inspection.completed_by),
        notes: inspection.notes,
        checks,
        defects,
        customerSignature:
          inspection.customer_signature_path || inspection.customer_signer_name
            ? { name: inspection.customer_signer_name, signedAt: inspection.customer_signed_at }
            : null,
        previousIssuedAt,
      },
      t,
    );
    const [logo, signature] = await Promise.all([
      organization.logo_path ? loadOrgImage(organization.logo_path) : null,
      inspection.customer_signature_path ? loadOrgImage(inspection.customer_signature_path) : null,
    ]);
    const assets: ProtocolAssets = { logo, signature, defectPhotos };
    const pdf = await renderProtocolPdf(model, assets);

    const admin = createAdminClient();
    const path = `${protocol.organization_id}/${protocol.year}/${protocol.id}.pdf`;
    const upload = await admin.storage
      .from(PROTOCOLS_BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw upload.error;
    // Only the first PDF counts: a stored protocol is never replaced.
    const { data: stored, error } = await admin
      .from("protocols")
      .update({ pdf_path: path, pdf_size: pdf.length, generated_at: generatedAt })
      .eq("id", protocol.id)
      .is("pdf_path", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return stored ?? (await protocolOf(inspectionId));
  } catch (error) {
    console.error("Protocol could not be generated", protocol.id, error);
    return null;
  }
}

/** The protocol's PDF file name in its language, e.g. "Protokol-2026-0007.pdf". */
export async function protocolFileName(protocol: Protocol) {
  const t = await getTranslations({ locale: protocol.locale, namespace: "protocol.pdf" });
  return t("fileName", {
    number: protocolFileNumber(
      protocolNumber(protocol.year, protocol.number, protocol.number_format),
    ),
  });
}

/**
 * E-mails the stored PDF in the protocol's language, replies going to the
 * organization. Returns false when the PDF or the e-mail fails.
 */
export async function emailProtocol(protocol: Protocol, recipient: string): Promise<boolean> {
  if (!protocol.pdf_path) return false;
  const supabase = await createClient();
  const [{ data: file }, { data: organization }, { data: inspection }] = await Promise.all([
    supabase.storage.from(PROTOCOLS_BUCKET).download(protocol.pdf_path),
    supabase
      .from("organizations")
      .select("name, email, timezone")
      .eq("id", protocol.organization_id)
      .single(),
    supabase
      .from("inspections")
      .select("completed_at, site:sites(name)")
      .eq("id", protocol.inspection_id)
      .single(),
  ]);
  if (!file || !organization || !inspection?.completed_at) return false;

  const number = protocolNumber(protocol.year, protocol.number, protocol.number_format);
  const t = await getTranslations({ locale: protocol.locale, namespace: "protocol.email" });
  const values = {
    number,
    organization: organization.name,
    site: inspection.site?.name ?? "",
    date: new Intl.DateTimeFormat(protocol.locale, {
      dateStyle: "medium",
      timeZone: organization.timezone,
    }).format(new Date(inspection.completed_at)),
  };
  const { html, text } = renderEmail({
    heading: t("heading", values),
    body: t("body", values),
    footnote: organization.email ? t("replyHint", values) : t("footnote", values),
  });
  return sendEmail({
    to: recipient,
    subject: t("subject", values),
    html,
    text,
    fromName: organization.name,
    replyTo: organization.email,
    attachments: [
      {
        filename: await protocolFileName(protocol),
        content: Buffer.from(await file.arrayBuffer()),
      },
    ],
  });
}
