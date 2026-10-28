import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { protocolFileNumber, protocolNumber } from "@/lib/protocol";
import { DEFAULT_PROTOCOL_TEMPLATE } from "@/lib/protocol-template/default-template";
import { DEVICE_COLUMNS, templateSchema } from "@/lib/protocol-template/schema";
import { signedUrl } from "@/lib/storage";
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

  const [{ data: version }, { data: protocols }, { data: deviceTypes }] = await Promise.all([
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
      .select("name")
      .eq("organization_id", organization.id)
      .order("name"),
  ]);
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
      />
    </>
  );
}
