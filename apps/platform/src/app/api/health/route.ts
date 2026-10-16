import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** How long the database may take before the check reports it down. */
const TIMEOUT_MS = 3000;

/**
 * Can the app reach its database? The smallest possible read, with the server's
 * key (the public key has no access to tables); nothing of it is returned.
 */
async function databaseReachable(): Promise<boolean> {
  try {
    const env = serverEnv();
    const key = env.SUPABASE_SECRET_KEY;
    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/organizations?select=id&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * For uptime monitoring: 200 when the app and its database answer, 503 when the
 * database doesn't (no details beyond that).
 */
export async function GET() {
  const database = await databaseReachable();
  return NextResponse.json(
    { status: database ? "ok" : "degraded", database: database ? "ok" : "unreachable" },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
