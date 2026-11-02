import { json, CORS_HEADERS } from "@/lib/mcp/http";
import { registerClient } from "@/lib/mcp/oauth";

// Dynamic Client Registration (RFC 7591) for AI assistants (part 31).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 16 * 1024) return json({ error: "invalid_client_metadata", error_description: "Too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_client_metadata", error_description: "The body must be JSON" }, 400);
  }
  const result = await registerClient(body);
  if (!result.ok)
    return json(
      { error: result.failure.error, error_description: result.failure.error_description },
      result.failure.status,
    );
  return json(result.body, 201);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
