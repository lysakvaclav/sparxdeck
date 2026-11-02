import "server-only";
import { serverEnv } from "@/lib/env";
import { MARKETING_URL } from "@/lib/site";
import { MCP_PATH, SCOPES, mcpResourceUrl } from "./config";

// Addresses and documents of the MCP server and its authorization server
// (part 31), as the OAuth discovery RFCs name them.

export function appOrigin(): string {
  return new URL(serverEnv().NEXT_PUBLIC_APP_URL).origin;
}

export function resourceUrl(): string {
  return mcpResourceUrl(appOrigin());
}

/** RFC 9728: the path-aware location for a resource at /api/mcp. */
export function protectedResourceMetadataUrl(): string {
  return `${appOrigin()}/.well-known/oauth-protected-resource${MCP_PATH}`;
}

export function protectedResourceMetadata() {
  return {
    resource: resourceUrl(),
    authorization_servers: [appOrigin()],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "SparxDeck",
    resource_documentation: `${MARKETING_URL}/en/mcp`,
  };
}

/** RFC 8414 metadata of the authorization server built into the platform. */
export function authorizationServerMetadata() {
  const origin = appOrigin();
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [...SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${MARKETING_URL}/en/mcp`,
  };
}

/**
 * Bearer tokens, not cookies: any origin may call (browser-based clients and
 * inspectors need it), and a page can't ride on a signed-in session.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Retry-After",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS, ...extra },
  });
}

/** 401 that tells the client where to find out how to get a token (RFC 9728, section 5.1). */
export function unauthorized(error?: "invalid_token", description?: string): Response {
  const parts = [
    `resource_metadata="${protectedResourceMetadataUrl()}"`,
    `scope="${SCOPES.join(" ")}"`,
    ...(error ? [`error="${error}"`] : []),
    ...(description ? [`error_description="${description.replace(/"/g, "'")}"`] : []),
  ];
  return json(
    { error: error ?? "unauthorized", error_description: description ?? "A bearer token is required." },
    401,
    { "WWW-Authenticate": `Bearer ${parts.join(", ")}` },
  );
}
