import { createMcpHandler, originValidationResponse, type AuthInfo } from "@modelcontextprotocol/server";
import { RATE_PER_MINUTE } from "@/lib/mcp/config";
import { hitRate, recordAudit } from "@/lib/mcp/guard";
import { appOrigin, json, resourceUrl, unauthorized, withCors } from "@/lib/mcp/http";
import { principalForToken, type McpPrincipal } from "@/lib/mcp/oauth";
import { buildServer } from "@/lib/mcp/server";

// The MCP endpoint (part 31): Streamable HTTP, stateless. One request = one
// fresh server for the member the bearer token speaks for. Both protocol eras
// are served: 2026-07-28 and, through the SDK's stateless fallback, 2025.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  ({ authInfo }) => {
    const principal = authInfo?.extra?.principal as McpPrincipal | undefined;
    if (!principal) throw new Error("MCP request without a verified principal");
    return buildServer(principal);
  },
  {
    legacy: "stateless",
    // One JSON answer per request; a stream only if a tool reports progress.
    responseMode: "auto",
    maxRequestBodySize: 256 * 1024,
    onerror: (error) => console.error("mcp", error),
  },
);

/** Browsers may only call from this app's own pages or this machine; other clients send no Origin. */
function allowedOrigins(): string[] {
  const hosts = [new URL(appOrigin()).hostname];
  if (process.env.NODE_ENV !== "production") hosts.push("localhost", "127.0.0.1", "[::1]");
  return hosts;
}

async function serve(request: Request): Promise<Response> {
  const badOrigin = originValidationResponse(request, allowedOrigins());
  if (badOrigin) return withCors(badOrigin);

  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!token) return unauthorized();

  const verified = await principalForToken(token);
  if (!verified.ok) {
    if (verified.reason === "disabled")
      return json(
        {
          error: "access_denied",
          error_description:
            "AI assistants are turned off for this company. Its owner can turn them on in SparxDeck under Settings, AI assistants.",
        },
        403,
      );
    return unauthorized("invalid_token", "The token is invalid, expired or revoked.");
  }
  const principal = verified.principal;

  const rate = await hitRate(principal.tokenId);
  if (!rate.ok) {
    // One audit row when the limit is first hit, not one per refused call.
    if (rate.first)
      await recordAudit({ principal, method: "http", outcome: "rate_limited", errorCode: "rate_limited" });
    return json(
      {
        error: "rate_limited",
        error_description: `Too many requests (at most ${RATE_PER_MINUTE} a minute). Try again in ${rate.retryAfter} seconds.`,
      },
      429,
      { "Retry-After": String(rate.retryAfter) },
    );
  }

  const authInfo: AuthInfo = {
    token,
    clientId: principal.tokenId,
    scopes: principal.scopes,
    expiresAt: principal.expiresAt,
    resource: new URL(resourceUrl()),
    extra: { principal },
  };
  return withCors(await handler.fetch(request, { authInfo }));
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
