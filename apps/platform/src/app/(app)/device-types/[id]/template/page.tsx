import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CubeIcon } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { isManager, requireMembership } from "@/lib/auth";
import { getDeviceType } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "../../template-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("deviceTypes.editor");
  return { title: t("title") };
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!isManager(membership.role)) redirect(`/device-types/${id}`);
  const type = await getDeviceType(id);
  if (!type) notFound();
  const t = await getTranslations("deviceTypes");

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("id, name, version, is_sample")
    .eq("device_type_id", type.id)
    .eq("active", true)
    .maybeSingle();
  const { data: items } = template
    ? await supabase
        .from("checklist_template_items")
        .select("id, label, item_type, required, fail_creates_defect, photo_required")
        .eq("template_id", template.id)
        .order("sort_order")
    : { data: [] };

  return (
    <>
      <PageHeader
        icon={CubeIcon}
        iconClassName={appIcon("deviceTypes").tone}
        title={t("editor.title")}
        breadcrumbs={[
          { label: t("title"), href: "/device-types" },
          { label: type.name, href: `/device-types/${type.id}` },
        ]}
      />
      <PageBody width="medium">
        <TemplateEditor
          deviceTypeId={type.id}
          initialName={template?.name ?? type.name}
          initialItems={(items ?? []).map((item) => ({
            id: item.id,
            label: item.label,
            type: item.item_type,
            required: item.required,
            failCreatesDefect: item.fail_creates_defect,
            photoRequired: item.photo_required,
          }))}
          isSample={template?.is_sample ?? false}
          currentVersion={template?.version ?? 0}
        />
      </PageBody>
    </>
  );
}
