import "server-only";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import { renderEmail, sendEmail } from "@/lib/email";
import { memberNames } from "@/lib/inspection-data";
import { renderProtocolPdf, type ProtocolLogo } from "@/lib/pdf/protocol";
import {
  buildProtocol,
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

/** The inspection's protocol, if it has one. */
export async function protocolOf(inspectionId: string): Promise<Protocol | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("protocols")
    .select("*")
    .eq("inspection_id", inspectionId)
    .maybeSingle();
  return data;
}

/** The logo as react-pdf takes it (PNG or JPEG); WebP is converted. Null if unusable. */
async function loadLogo(path: string): Promise<ProtocolLogo | null> {
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
    console.error("Protocol logo could not be loaded", error);
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
            "started_at, completed_at, completed_by, notes, site:sites(name, address, customer:customers(name, company_id, vat_id, contact_person, billing_address))",
          )
          .eq("id", inspectionId)
          .single(),
        supabase.from("organizations").select("*").eq("id", protocol.organization_id).single(),
        fetchAll((from, to) =>
          supabase
            .from("inspection_items")
            .select(
              "id, outcome, skip_reason, notes, checked_by, device:devices(label_number, serial_number, next_due_on, location:locations(name, sort_order), type:device_types(name))",
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
              checkedBy: name(item.checked_by),
              note: item.notes,
              answers: answersOf.get(item.id) ?? [],
            },
          ]
        : [],
    );
    const seen = new Set<string>();
    const defects: ProtocolDefect[] = [];
    for (const [list, again] of [
      [created, false],
      [observed.flatMap((event) => (event.defect ? [event.defect] : [])), true],
    ] as const) {
      for (const defect of list) {
        if (seen.has(defect.id)) continue;
        seen.add(defect.id);
        defects.push({
          number: defect.number,
          labelNumber: defect.device?.label_number ?? 0,
          description: defect.description,
          severity: defect.severity,
          again,
        });
      }
    }

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
      },
      t,
    );
    const logo = organization.logo_path ? await loadLogo(organization.logo_path) : null;
    const pdf = await renderProtocolPdf(model, logo);

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
  return t("fileName", { number: protocolNumber(protocol.year, protocol.number) });
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

  const number = protocolNumber(protocol.year, protocol.number);
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
