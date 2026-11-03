import { createHash } from "node:crypto";
import { SCOPE_READ, SCOPE_WRITE, SCOPES, type McpScope } from "./config";

// OAuth 2.1 rules for the MCP authorization server (part 31), without the
// database: PKCE, redirect URIs, scopes, client ID metadata URLs and the
// resource indicator. Tests in tests/mcp-oauth.test.ts.

/** PKCE (S256 only): BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier, "ascii").digest("base64url") === challenge;
}

/** A code challenge as S256 produces it: 43 base64url characters. */
export function validChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"]);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Where an authorization code may be sent: https anywhere, http only to this
 * machine (desktop clients listen on a loopback port), or an app's own scheme
 * (com.example.app:/callback). Never a fragment, never credentials in the URL.
 */
export function validRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password || value.length > 2000) return false;
  if (url.protocol === "https:") return Boolean(url.hostname);
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && !BLOCKED_SCHEMES.has(url.protocol);
}

/**
 * Whether a redirect URI the client sent matches one it registered: exactly,
 * except that a loopback http URI may use any port (RFC 8252, section 7.3).
 */
export function redirectMatches(requested: string, registered: readonly string[]): boolean {
  if (registered.includes(requested)) return true;
  let asked: URL;
  try {
    asked = new URL(requested);
  } catch {
    return false;
  }
  if (asked.protocol !== "http:" || !LOOPBACK.has(asked.hostname)) return false;
  return registered.some((entry) => {
    try {
      const known = new URL(entry);
      return (
        known.protocol === "http:" &&
        known.hostname === asked.hostname &&
        known.pathname === asked.pathname &&
        known.search === asked.search
      );
    } catch {
      return false;
    }
  });
}

/**
 * The scopes a client asked for, as ours. Unknown ones are dropped; reading is
 * always part of the grant (writing without reading makes no sense).
 */
export function parseScopes(scope: string | null | undefined): McpScope[] {
  const asked = new Set((scope ?? "").split(/\s+/).filter(Boolean));
  return asked.has(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
}

export function isScope(value: string): value is McpScope {
  return (SCOPES as readonly string[]).includes(value);
}

/**
 * A Client ID Metadata Document's id: an https URL with a path (the document
 * lives there), without a fragment or credentials.
 */
export function isMetadataClientId(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    return (
      url.protocol === "https:" &&
      url.pathname.length > 1 &&
      !url.hash &&
      !url.username &&
      !url.password &&
      clientId.length <= 2000
    );
  } catch {
    return false;
  }
}

/**
 * Whether the server may fetch this URL (a client's metadata document):
 * https on port 443 to a public host name. Literal IP addresses and local
 * names are refused, so a client can't make the server call into a private
 * network (SSRF).
 */
export function safeToFetch(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost")
    return false;
  // IPv4 literals and anything bracketed (IPv6).
  if (/^\d+(\.\d+){3}$/.test(host) || host.startsWith("[")) return false;
  return true;
}

/** Resource identifiers compare without a trailing slash or fragment (RFC 8707). */
export function sameResource(a: string, b: string): boolean {
  const normal = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return null;
    }
  };
  const left = normal(a);
  return left !== null && left === normal(b);
}

/**
 * Whether a Client ID Metadata Document describes a client that can use this
 * server as a public client (no secret, PKCE only). ChatGPT's document, for
 * one, prefers private_key_jwt but also lists "none"; the client then picks
 * "none" because our metadata offers no private_key_jwt.
 */
export function publicClientDocument(doc: {
  token_endpoint_auth_method?: string;
  token_endpoint_auth_methods_supported?: string[];
}): boolean {
  if (doc.token_endpoint_auth_methods_supported?.includes("none")) return true;
  return !doc.token_endpoint_auth_method || doc.token_endpoint_auth_method === "none";
}

/**
 * Whether a resource indicator names this MCP server: its endpoint URL, or its
 * origin (some clients send the origin of the server they connected).
 */
export function ourResource(value: string, resourceUrl: string): boolean {
  if (sameResource(value, resourceUrl)) return true;
  try {
    return sameResource(value, new URL(resourceUrl).origin);
  } catch {
    return false;
  }
}

