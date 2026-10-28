import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { templateSchema } from "@/lib/protocol-template/schema";
import { toTemplateFile } from "@/lib/protocol-template/transfer";
import { ORG_ASSETS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A protocol template as a file to take to another company (part 22, stage
 * D): `?version=N` that version, else the draft or the current version. Its
 * own logo goes inside the file; the path into this company's storage
 * doesn't. Owners and admins.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const active = await requireManager();
  if (!active || !idSchema.safeParse(id).success) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("protocol_templates")
    .select("id, name, description, draft, current_version_id")
    .eq("id", id)
    .maybeSingle();
  if (!template) return new NextResponse(null, { status: 404 });

  const version = Number(request.nextUrl.searchParams.get("version"));
  let content: unknown = template.draft;
  if (version > 0 || !content) {
    const query = supabase.from("protocol_template_versions").select("content").eq("template_id", id);
    const { data } =
      version > 0
        ? await query.eq("version", version).maybeSingle()
        : await query.eq("id", template.current_version_id ?? "").maybeSingle();
    content = data?.content;
  }
  const parsed = templateSchema.safeParse(content);
  if (!parsed.success) return new NextResponse(null, { status: 404 });

  const header = parsed.data.blocks.find((block) => block.type === "header");
  let logo: string | null = null;
  if (header?.type === "header" && header.logo.source === "template" && header.logo.path?.startsWith(`${active.organization.id}/`)) {
    const { data } = await supabase.storage.from(ORG_ASSETS_BUCKET).download(header.logo.path);
    if (data) logo = Buffer.from(await data.arrayBuffer()).toString("base64");
  }
  const file = toTemplateFile(template.name, template.description, parsed.data, logo);
  const name = `${template.name}${version > 0 ? `-v${version}` : ""}`.replace(/[\\/:*?"<>|]+/g, "-");
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="protocol-template.json"; filename*=UTF-8''${encodeURIComponent(`${name}.json`)}`,
      "Cache-Control": "no-store",
    },
  });
}
