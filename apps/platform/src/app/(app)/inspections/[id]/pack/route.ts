import { NextResponse } from "next/server";
import { getActiveMembership } from "@/lib/auth";
import { loadFieldPack } from "@/lib/field-pack";
import { getInspection } from "@/lib/inspection-data";

export const runtime = "nodejs";

/**
 * The inspection's pack for the phone (see FieldPack): fetched while online and
 * kept for work without a signal. A completed inspection answers {closed: true},
 * a missing (cancelled) one 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store" };
  const active = await getActiveMembership();
  if (!active) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const inspection = await getInspection(id);
  if (!inspection) return NextResponse.json({ error: "notFound" }, { status: 404, headers });
  if (inspection.status === "completed") return NextResponse.json({ closed: true }, { headers });
  const pack = await loadFieldPack(inspection, {
    userId: active.membership.user_id,
    role: active.membership.role,
  });
  return NextResponse.json(pack, { headers });
}
