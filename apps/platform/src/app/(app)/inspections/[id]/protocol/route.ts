import { NextResponse, type NextRequest } from "next/server";
import { getActiveMembership } from "@/lib/auth";
import { protocolFileName, protocolHistoryOf, protocolOf } from "@/lib/protocols";
import { PROTOCOLS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Long enough to start the download, too short to pass the link around. */
const LINK_SECONDS = 60;

/**
 * The inspection's protocol PDF: a fresh, short-lived signed link to the stored
 * file (RLS decides who may see it), downloaded under its own name.
 * `?inline` opens it in the browser instead (to print); `?version=N` opens a
 * superseded version instead of the current one.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success || !(await getActiveMembership()))
    return new NextResponse(null, { status: 404 });
  const version = Number(request.nextUrl.searchParams.get("version"));
  const protocol = version > 0
    ? (await protocolHistoryOf(id)).find((entry) => entry.version === version)
    : await protocolOf(id);
  if (!protocol?.pdf_path) return new NextResponse(null, { status: 404 });

  const inline = request.nextUrl.searchParams.has("inline");
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(PROTOCOLS_BUCKET)
    .createSignedUrl(protocol.pdf_path, LINK_SECONDS, {
      download: inline ? false : await protocolFileName(protocol),
    });
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}
