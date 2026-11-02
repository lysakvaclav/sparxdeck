import { json, protectedResourceMetadata, CORS_HEADERS } from "@/lib/mcp/http";

// RFC 9728 Protected Resource Metadata of the MCP endpoint, at the path-aware
// location (/.well-known/oauth-protected-resource/api/mcp) and at the root.

export const dynamic = "force-dynamic";

export function GET() {
  return json(protectedResourceMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
