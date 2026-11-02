import { authorizationServerMetadata, json, CORS_HEADERS } from "@/lib/mcp/http";

// RFC 8414 metadata of the authorization server in the platform (also under a
// path suffix, which some clients append).

export const dynamic = "force-dynamic";

export function GET() {
  return json(authorizationServerMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
