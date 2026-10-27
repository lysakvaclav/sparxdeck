import "server-only";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import { formatLabel } from "@/lib/devices";
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
import { imageNeeds, readSnapshot, SNAPSHOT_SCHEMA, type ProtocolSnapshot } from "@/lib/protocol-snapshot";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { usableTemplate } from "@/lib/protocol-template/requirements";
import type { ProtocolTemplate } from "@/lib/protocol-template/schema";
import { ORG_ASSETS_BUCKET, PROTOCOLS_BUCKET, sniffImage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

// Protocols are read with the user's session (RLS: their company only) and
// written by the service role: the PDF lands in the "protocols" bucket, which no
// app user can write, so a stored protocol never changes. It is drawn by the
// template version the database chose when it was numbered (part 22), and
// stored with a snapshot of its data, so it can be drawn again as issued.

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

/**
 * An org-assets image of the company as react-pdf takes it (PNG or JPEG);
 * WebP is converted. Null if unusable or outside the company's folder.
 */
async function loadOrgImage(organizationId: string, path: string): Promise<ProtocolLogo | null> {
  if (!path.startsWith(`${organizationId}/`)) return null;
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

/** The template a protocol version is drawn by; the default when it has none or it is unusable. */
async function templateOf(versionId: string | null): Promise<ProtocolTemplate> {
  if (!versionId) return DEFAULT_PROTOCOL_TEMPLATE;
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocol_template_versions")
    .select("content")
    .eq("id", versionId)
    .maybeSingle();
  const { template, fallback } = usableTemplate(data?.content);
  if (fallback) console.error("Protocol template unusable, the default is drawn", versionId);
  return template;
}

/** Draws a protocol's PDF from its snapshot and template. */
async function drawProtocol(
  organizationId: string,
  snapshot: ProtocolSnapshot,
  template: ProtocolTemplate,
): Promise<Buffer> {
  const { input, images } = snapshot;
  const load = (path: string) => loadOrgImage(organizationId, path);
  const [logo, defectPhotos, inspectionPhotos] = await Promise.all([
    images.logo ? load(images.logo) : null,
    Promise.all(
      images.defectPhotos.map(async ([number, paths]) => {
        const loaded = (await Promise.all(paths.map(load))).filter(
          (image): image is ProtocolLogo => image !== null,
        );
        return [number, loaded] as const;
      }),
    ),
    Promise.all(
      images.inspectionPhotos.map(async (photo) => {
        const image = await load(photo.path);
        return image ? [{ image, caption: photo.caption }] : [];
      }),
    ),
  ]);
  const assets: ProtocolAssets = {
    logo,
    signature: images.signature
      ? { data: Buffer.from(images.signature.base64, "base64"), format: images.signature.format }
      : null,
    defectPhotos: new Map(defectPhotos.filter(([, list]) => list.length > 0)),
    inspectionPhotos: inspectionPhotos.flat(),
  };
  const t = (await getTranslations({
    locale: input.locale,
    namespace: "protocol.pdf",
  })) as unknown as Translate;
  return renderProtocolPdf(buildProtocol(input, t), assets, template);
}

/**
 * Collects what the protocol is made from: the inspection's records as they
 * are now, and the images its template draws.
 */
async function collectSnapshot(
  protocol: Protocol,
  template: ProtocolTemplate,
): Promise<ProtocolSnapshot | null> {
  const supabase = await createClient();
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
            "id, outcome, skip_reason, notes, checked_by, original_checked_by, location_state, location_note, device:devices(label_number, serial_number, manufacturer, model, manufacture_year, next_due_on, location:locations(name, sort_order), type:device_types(name))",
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
  const labelOfItem = new Map<string, number>();
  const checks: ProtocolCheck[] = items.flatMap((item) => {
    if (!item.device || !item.outcome) return [];
    labelOfItem.set(item.id, item.device.label_number);
    return [
      {
        labelNumber: item.device.label_number,
        typeName: item.device.type?.name ?? "",
        locationName: item.device.location?.name ?? null,
        locationOrder: item.device.location?.sort_order ?? null,
        serialNumber: item.device.serial_number,
        manufacturer: item.device.manufacturer,
        model: item.device.model,
        manufactureYear: item.device.manufacture_year,
        outcome: item.outcome,
        skipReason: item.skip_reason,
        nextDueOn: item.device.next_due_on,
        // A correction keeps the technician who did the check on site.
        checkedBy: name(item.original_checked_by ?? item.checked_by),
        note: item.notes,
        answers: answersOf.get(item.id) ?? [],
        scanLocation: { state: item.location_state, note: item.location_note },
      },
    ];
  });
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

  // Only the photos the template draws, so the protocol stays quick to render.
  const needs = imageNeeds(template);
  const defectPhotoRows =
    needs.perDefect > 0 && defectIdByNumber.size > 0
      ? await supabase
          .from("defect_photos")
          .select("defect_id, storage_path")
          .in("defect_id", [...defectIdByNumber.values()])
          .order("created_at")
      : { data: [] };
  const photoPathsByDefect = new Map<string, string[]>();
  for (const row of defectPhotoRows.data ?? []) {
    const list = photoPathsByDefect.get(row.defect_id) ?? [];
    if (list.length < needs.perDefect) list.push(row.storage_path);
    photoPathsByDefect.set(row.defect_id, list);
  }
  const defectPhotos: [number, string[]][] = [...defectIdByNumber].flatMap(
    ([number, defectId]): [number, string[]][] => {
      const paths = photoPathsByDefect.get(defectId) ?? [];
      return paths.length > 0 ? [[number, paths]] : [];
    },
  );
  const checkPhotoRows =
    needs.checkPhotos > 0 && labelOfItem.size > 0
      ? await supabase
          .from("inspection_photos")
          .select("item_id, storage_path, created_at, item:inspection_items!inner(inspection_id)")
          .eq("item.inspection_id", inspectionId)
          .order("created_at")
          .limit(needs.checkPhotos)
      : { data: [] };
  const inspectionPhotos = (checkPhotoRows.data ?? []).flatMap((row) => {
    const label = labelOfItem.get(row.item_id);
    return label === undefined ? [] : [{ path: row.storage_path, caption: formatLabel(label) }];
  });

  // The customer's signature itself: the file is replaced if they sign again.
  const signatureImage = inspection.customer_signature_path
    ? await loadOrgImage(protocol.organization_id, inspection.customer_signature_path)
    : null;

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

  const site = inspection.site;
  const customer = site?.customer;
  return {
    schema: SNAPSHOT_SCHEMA,
    input: {
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
      generatedAt: new Date().toISOString(),
      completedBy: name(inspection.completed_by),
      notes: inspection.notes,
      checks,
      defects,
      customerSignature:
        inspection.customer_signature_path || inspection.customer_signer_name
          ? { name: inspection.customer_signer_name, signedAt: inspection.customer_signed_at }
          : null,
      previousIssuedAt,
      scanLocation: organization.scan_location_enabled,
    },
    images: {
      logo: organization.logo_path,
      signature: signatureImage
        ? { format: signatureImage.format, base64: signatureImage.data.toString("base64") }
        : null,
      defectPhotos,
      inspectionPhotos,
    },
  };
}

/**
 * Renders the protocol's PDF from the inspection's records and stores it with
 * its snapshot, unless it already has one. Returns the protocol (with its
 * PDF), or null on failure.
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
    const template = await templateOf(protocol.template_version_id);
    const snapshot = await collectSnapshot(protocol, template);
    if (!snapshot) return null;
    const pdf = await drawProtocol(protocol.organization_id, snapshot, template);

    const admin = createAdminClient();
    const path = `${protocol.organization_id}/${protocol.year}/${protocol.id}.pdf`;
    const upload = await admin.storage
      .from(PROTOCOLS_BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw upload.error;
    // Only the first PDF counts: a stored protocol is never replaced.
    const { data: stored, error } = await admin
      .from("protocols")
      .update({
        pdf_path: path,
        pdf_size: pdf.length,
        generated_at: snapshot.input.generatedAt,
        snapshot: snapshot as unknown as Json,
      })
      .eq("id", protocol.id)
      .is("pdf_path", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return stored ?? (await protocolOf(protocol.inspection_id));
  } catch (error) {
    console.error("Protocol could not be generated", protocol.id, error);
    return null;
  }
}

/**
 * Draws an issued protocol again from its snapshot and the template version it
 * recorded: the same as when it was issued. Null for protocols from before
 * snapshots (their stored PDF is all there is).
 */
export async function redrawProtocol(protocol: Protocol): Promise<Buffer | null> {
  const snapshot = readSnapshot(protocol.snapshot);
  if (!snapshot) return null;
  return drawProtocol(
    protocol.organization_id,
    snapshot,
    await templateOf(protocol.template_version_id),
  );
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
