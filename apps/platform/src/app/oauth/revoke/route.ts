import { json, CORS_HEADERS } from "@/lib/mcp/http";
import { authenticateClient, revokeToken } from "@/lib/mcp/oauth";

// Token revocation (RFC 7009): ends the whole connection. Always 200 for an
// unknown token, so it reveals nothing.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 16 * 1024) return json({ error: "invalid_request", error_description: "Too large" }, 413);
  const form = new URLSearchParams(text);
  const client = await authenticateClient(form, request.headers.get("authorization"));
  if ("error" in client)
    return json({ error: client.error, error_description: client.error_description }, client.status);
  const token = form.get("token");
  if (token) await revokeToken(token, client);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", ...CORS_HEADERS } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
