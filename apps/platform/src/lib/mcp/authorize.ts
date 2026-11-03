import "server-only";
import type { McpScope } from "./config";
import { appOrigin, resourceUrl } from "./http";
import { findClient, type McpClient } from "./oauth";
import { ourResource, parseScopes, redirectMatches, validChallenge } from "./oauth-rules";

// The authorization request of an AI assistant (OAuth 2.1, part 31), checked
// the same way when the consent page shows and when the member answers.
// Until the client and its redirect URI are known good, errors are shown on
// our page; after that they go back to the client (RFC 6749, section 4.1.2.1).

export type AuthorizeParams = Record<string, string | string[] | undefined>;

export type AuthorizeRequest = {
  client: McpClient;
  redirectUri: string;
  state: string | null;
  scopes: McpScope[];
  codeChallenge: string;
  resource: string;
};

export type AuthorizeCheck =
  | { kind: "ok"; request: AuthorizeRequest }
  | { kind: "page"; error: "unknown_client" | "redirect_invalid" }
  | { kind: "redirect"; url: string };

const one = (params: AuthorizeParams, key: string): string | null => {
  const value = params[key];
  const text = Array.isArray(value) ? value[0] : value;
  return text && text.length <= 4000 ? text : null;
};

/** Where the client gets its answer: our issuer is named (RFC 9207), state comes back unchanged. */
export function clientRedirect(redirectUri: string, values: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) if (value !== null) url.searchParams.set(key, value);
  url.searchParams.set("iss", appOrigin());
  return url.toString();
}

export async function checkAuthorizeRequest(params: AuthorizeParams): Promise<AuthorizeCheck> {
  const clientId = one(params, "client_id");
  const client = clientId ? await findClient(clientId) : null;
  if (!client) return { kind: "page", error: "unknown_client" };

  const asked = one(params, "redirect_uri");
  const redirectUri = asked ?? (client.redirectUris.length === 1 ? client.redirectUris[0]! : null);
  if (!redirectUri || !redirectMatches(redirectUri, client.redirectUris))
    return { kind: "page", error: "redirect_invalid" };

  const state = one(params, "state");
  const back = (error: string, description: string): AuthorizeCheck => ({
    kind: "redirect",
    url: clientRedirect(redirectUri, { error, error_description: description, state }),
  });

  if (one(params, "response_type") !== "code") return back("unsupported_response_type", "Only response_type=code");
  const codeChallenge = one(params, "code_challenge");
  if (!codeChallenge || !validChallenge(codeChallenge) || one(params, "code_challenge_method") !== "S256")
    return back("invalid_request", "PKCE with code_challenge_method=S256 is required");
  const resource = one(params, "resource");
  if (resource && !ourResource(resource, resourceUrl()))
    return back("invalid_target", "Tokens are issued only for this server's MCP endpoint");

  return {
    kind: "ok",
    request: {
      client,
      redirectUri,
      state,
      scopes: parseScopes(one(params, "scope")),
      codeChallenge,
      resource: resourceUrl(),
    },
  };
}

/** Hidden fields that carry the request through the consent form. */
export const AUTHORIZE_FIELDS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;
