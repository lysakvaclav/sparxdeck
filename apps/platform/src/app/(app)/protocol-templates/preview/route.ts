import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { previewProtocol } from "@/lib/protocols";
import { templateSchema } from "@/lib/protocol-template/schema";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A template is at most 512 kB in the database; a little room for the request around it. */
const MAX_BODY = 600_000;

/**
 * The template editor's preview (part 22): POST { template, inspection } and
 * get the PDF the template draws, with sample data or the records of one of
 * the company's completed inspections. Owners and admins; nothing is stored.
 */
export async function POST(request: NextRequest) {
  const active = await requireManager();
  if (!active) return new NextResponse(null, { status: 404 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return new NextResponse(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY) return new NextResponse(null, { status: 413 });

  let body: { template?: unknown; inspection?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const template = templateSchema.safeParse(body.template);
  if (!template.success) return NextResponse.json({ error: "templateInvalid" }, { status: 422 });
  const inspection =
    body.inspection == null ? null : idSchema.safeParse(body.inspection).data ?? undefined;
  if (inspection === undefined) return new NextResponse(null, { status: 400 });

  const pdf = await previewProtocol(active.organization.id, template.data, inspection).catch(
    (error: unknown) => {
      console.error("Protocol preview failed", error);
      return null;
    },
  );
  if (!pdf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}
