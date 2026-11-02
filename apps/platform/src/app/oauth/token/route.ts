import { json, resourceUrl, CORS_HEADERS } from "@/lib/mcp/http";
import { authenticateClient, exchangeCode, refreshTokens, type OAuthFailure } from "@/lib/mcp/oauth";

// The token endpoint (OAuth 2.1): authorization_code with PKCE, and rotating
// refresh tokens. Answers are never cached.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failure = (f: OAuthFailure) =>
  json(
    { error: f.error, error_description: f.error_description },
    f.status,
    f.status === 401 ? { "WWW-Authenticate": 'Basic realm="sparxdeck"' } : {},
  );

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/x-www-form-urlencoded"))
    return json({ error: "invalid_request", error_description: "Use application/x-www-form-urlencoded" }, 400);
  const text = await request.text();
  if (text.length > 16 * 1024) return json({ error: "invalid_request", error_description: "Too large" }, 413);
  const form = new URLSearchParams(text);

  const client = await authenticateClient(form, request.headers.get("authorization"));
  if ("error" in client) return failure(client);

  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const code = form.get("code");
    const verifier = form.get("code_verifier");
    if (!code || !verifier)
      return json({ error: "invalid_request", error_description: "code and code_verifier are required" }, 400);
    const result = await exchangeCode({
      client,
      code,
      verifier,
      redirectUri: form.get("redirect_uri"),
      resource: form.get("resource"),
    });
    return "error" in result ? failure(result) : json(result);
  }
  if (grant === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (!refreshToken)
      return json({ error: "invalid_request", error_description: "refresh_token is required" }, 400);
    const result = await refreshTokens({
      client,
      refreshToken,
      scope: form.get("scope"),
      resource: form.get("resource"),
      expectedResource: resourceUrl(),
    });
    return "error" in result ? failure(result) : json(result);
  }
  return json({ error: "unsupported_grant_type", error_description: "Use authorization_code or refresh_token" }, 400);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
