import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { protocolFileNumber, protocolNumber } from "@/lib/protocol";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { DEVICE_COLUMNS, templateSchema } from "@/lib/protocol-template/schema";
import { memberNames } from "@/lib/inspection-data";
import { signedUrl } from "@/lib/storage";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import type { Placeholders } from "./block-properties";
import { TemplateEditor } from "./template-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("protocolTemplates");
  if (!idSchema.safeParse(id).success) return { title: t("title") };
  const supabase = await createClient();
  const { data } = await supabase.from("protocol_templates").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? t("title") };
}

export default async function ProtocolTemplateEditorPage({ params }: Props) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const { membership, organization } = await requireMembership();
  // Technicians use templates; only owners and admins edit them.
  if (!isManager(membership.role)) redirect("/protocol-templates");

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("protocol_templates")
    .select("id, name, description, status, draft, current_version_id, draft_updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!template || template.status === "archived") notFound();

  const [
    { data: version },
    { data: protocols },
    { data: deviceTypes },
    { data: versionRows },
    { data: eventRows },
    { data: assignments },
    { data: templateNames },
    customers,
    names,
  ] = await Promise.all([
    template.draft || !template.current_version_id
      ? { data: null }
      : supabase
          .from("protocol_template_versions")
          .select("content")
          .eq("id", template.current_version_id)
          .maybeSingle(),
    // The latest protocols of the company, for a preview with real records.
    supabase
      .from("protocols")
      .select("year, number, number_format, generated_at, inspection:inspections(id, completed_at, site:sites(name))")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("device_types")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name"),
    // The history (stage D): published versions and what was done.
    supabase
      .from("protocol_template_versions")
      .select("id, version, note, published_by, published_at, content")
      .eq("template_id", id)
      .order("version", { ascending: false })
      .limit(50),
    supabase
      .from("protocol_template_events")
      .select("kind, version, note, actor, created_at")
      .eq("template_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("protocol_template_assignments")
      .select("template_id, customer_id, device_type_id")
      .eq("organization_id", organization.id),
    supabase.from("protocol_templates").select("id, name").eq("organization_id", organization.id),
    fetchAll((from, to) =>
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .order("name")
        .range(from, to),
    ),
    memberNames(organization.id),
  ]);
  const nameOf = (user: string | null) => (user ? (names.get(user) ?? null) : null);
  const templateName = new Map((templateNames ?? []).map((row) => [row.id, row.name]));
  const assignedTo = new Map<string, string>();
  for (const row of assignments ?? []) assignedTo.set(row.customer_id ?? row.device_type_id ?? "", row.template_id);
  const option = (row: { id: string; name: string }) => {
    const owner = assignedTo.get(row.id);
    return {
      id: row.id,
      name: row.name,
      mine: owner === id,
      elsewhere: owner && owner !== id ? (templateName.get(owner) ?? null) : null,
    };
  };
  const versions = (versionRows ?? []).flatMap((row) => {
    const content = templateSchema.safeParse(row.content);
    return content.success
      ? [{ id: row.id, version: row.version, note: row.note, by: nameOf(row.published_by), at: row.published_at, content: content.data }]
      : [];
  });
  const events = (eventRows ?? []).map((row) => ({
    kind: row.kind,
    version: row.version,
    note: row.note,
    by: nameOf(row.actor),
    at: row.created_at,
  }));
  const stored = templateSchema.safeParse(template.draft ?? version?.content);
  const initial = stored.success ? stored.data : DEFAULT_PROTOCOL_TEMPLATE;
  // The template's own logo, shown in the header's properties.
  const header = initial.blocks.find((block) => block.type === "header");
  const logoPath = header?.type === "header" ? header.logo.path : null;
  const logoUrl = logoPath ? await signedUrl(logoPath) : null;

  const locale = organization.default_locale === "en" ? "en" : "cs";
  const [t, tPdf, tProps, format] = await Promise.all([
    getTranslations("protocolTemplates"),
    getTranslations({ locale, namespace: "protocol.pdf" }),
    getTranslations("protocolTemplates.properties"),
    getFormatter(),
  ]);
  const columnTitle = (key: (typeof DEVICE_COLUMNS)[number]) =>
    key === "scan" ? tPdf("scanColumn") : tPdf(`columns.${key}`);
  const placeholders: Placeholders = {
    title: tPdf("title"),
    summary: tPdf("summaryTitle"),
    devices: tPdf("devicesTitle"),
    checklist: tPdf("checklistTitle"),
    defects: tPdf("defectsTitle"),
    gallery: tPdf("galleryTitle"),
    notes: tPdf("notesTitle"),
    signatures: {
      technician: tPdf("signTechnician"),
      customer: tPdf("signCustomer"),
      other: tPdf("signOther"),
    },
    columns: Object.fromEntries(DEVICE_COLUMNS.map((key) => [key, columnTitle(key)])) as Placeholders["columns"],
  };
  const inspections = (protocols ?? []).flatMap((protocol) =>
    protocol.inspection
      ? [
          {
            id: protocol.inspection.id,
            label: [
              protocolNumber(protocol.year, protocol.number, protocol.number_format),
              protocol.inspection.site?.name,
              protocol.inspection.completed_at
                ? format.dateTime(new Date(protocol.inspection.completed_at), { dateStyle: "medium" })
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : [],
  );
  const app = appIcon("protocolTemplates");

  return (
    <>
      <PageHeader
        icon={app.icon}
        iconClassName={app.tone}
        title={template.name}
        breadcrumbs={[{ label: t("title"), href: "/protocol-templates" }]}
      />
      {!stored.success && (template.draft || version) && (
        <p className="px-4 py-2 text-ui text-warning-text">{tProps("unreadable")}</p>
      )}
      <TemplateEditor
        key={template.draft_updated_at ?? template.current_version_id ?? template.id}
        templateId={template.id}
        name={template.name}
        description={template.description ?? ""}
        published={template.current_version_id !== null}
        hasDraft={template.draft !== null}
        initial={initial}
        placeholders={placeholders}
        inspections={inspections}
        fileName={t("editor.previewFile", { number: protocolFileNumber(template.name).slice(0, 60) })}
        deviceTypes={(deviceTypes ?? []).map((type) => type.name)}
        logoUrls={logoPath && logoUrl ? { [logoPath]: logoUrl } : {}}
        versions={versions}
        events={events}
        assignCustomers={customers.map(option)}
        assignDeviceTypes={(deviceTypes ?? []).map(option)}
        archived={false}
      />
    </>
  );
}
