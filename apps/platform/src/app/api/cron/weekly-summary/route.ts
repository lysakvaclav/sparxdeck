import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runWeeklyDigests } from "@/lib/digests";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
// Every organization in one run: give it room.
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The weekly summary job (vercel.json: Mondays early morning). Answers 404
 * unless called with the CRON_SECRET; `?dry` reports without sending.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 404 });
  const dryRun = request.nextUrl.searchParams.has("dry");
  const runs = await runWeeklyDigests({ dryRun });
  return NextResponse.json({ dryRun, runs }, { headers: { "Cache-Control": "no-store" } });
}
