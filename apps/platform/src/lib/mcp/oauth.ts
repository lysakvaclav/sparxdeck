import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { hashToken } from "@/lib/tokens";
import type { MemberRole } from "@/lib/supabase/database.types";
import {
  ACCESS_TOKEN_TTL,
  AUTH_CODE_TTL,
  REFRESH_TOKEN_TTL,
  SCOPE_READ,
  SCOPE_WRITE,
  TOKEN_PREFIX,
  type McpScope,
} from "./config";
import { mcpDb } from "./db";
import {
  isMetadataClientId,
  isScope,
  ourResource,
  publicClientDocument,
  safeToFetch,
  validRedirectUri,
  verifyPkce,
} from "./oauth-rules";

// The authorization server for MCP (part 31), built into the platform: no
// outside identity service. Clients register dynamically (RFC 7591) or bring a
// Client ID Metadata Document; codes need PKCE (S256) and name this server as
// their resource (RFC 8707); refresh tokens rotate, and a reused one revokes
// the whole connection. Only SHA-256 hashes of secrets are stored.

export type McpClient = {
  clientId: string;
  kind: "registered" | "metadata";
  clientName: string | null;
  clientUri: string | null;
  redirectUris: string[];
  authMethod: "none" | "client_secret_post" | "client_secret_basic";
  secretHash: string | null;
};

export type OAuthFailure = { error: string; error_description: string; status: number };

const fail = (error: string, description: string, status = 400): OAuthFailure => ({
  error,
  error_description: description,
  status,
});

function secret(prefix: string): string {
  return prefix + randomBytes(32).toString("base64url");
}

type ClientRow = {
  client_id: string;
  kind: "registered" | "metadata";
  client_name: string | null;
  client_uri: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: McpClient["authMethod"];
  secret_hash: string | null;
  fetched_at: Date | null;
};

const toClient = (row: ClientRow): McpClient => ({
  clientId: row.client_id,
  kind: row.kind,
  clientName: row.client_name,
  clientUri: row.client_uri,
  redirectUris: row.redirect_uris,
  authMethod: row.token_endpoint_auth_method,
  secretHash: row.secret_hash,
});

/** A metadata document is fetched again after a day. */
const METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const METADATA_MAX_BYTES = 64 * 1024;

export async function findClient(clientId: string): Promise<McpClient | null> {
  if (!clientId || clientId.length > 2000) return null;
  const db = mcpDb();
  const [row] = await db<ClientRow[]>`
    select client_id, kind, client_name, client_uri, redirect_uris,
           token_endpoint_auth_method, secret_hash, fetched_at
      from public.mcp_clients where client_id = ${clientId}`;
  if (row?.kind === "registered") return toClient(row);
  if (!isMetadataClientId(clientId)) return null;
  if (row && row.fetched_at && Date.now() - row.fetched_at.getTime() < METADATA_MAX_AGE_MS)
    return toClient(row);
  return fetchMetadataClient(clientId);
}

/** Private, loopback, link-local and similar addresses: never fetched. */
function privateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80") ||
    v6.startsWith("::ffff:")
  );
}

const metadataSchema = z.object({
  client_id: z.string(),
  client_name: z.string().max(200).optional(),
  client_uri: z.string().max(2048).optional(),
  redirect_uris: z.array(z.string()).min(1).max(10),
  token_endpoint_auth_method: z.string().optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).max(20).optional(),
});

async function fetchMetadataClient(clientId: string): Promise<McpClient | null> {
  if (!safeToFetch(clientId)) return null;
  try {
    const addresses = await lookup(new URL(clientId).hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) return null;
    const response = await fetch(clientId, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > METADATA_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const parsed = metadataSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return null;
    const doc = parsed.data;
    // The document must describe itself, and a public document can't hold a secret.
    if (doc.client_id !== clientId) return null;
    if (!publicClientDocument(doc)) return null;
    if (!doc.redirect_uris.every(validRedirectUri)) return null;
    const clientUri = doc.client_uri && /^https:\/\//.test(doc.client_uri) ? doc.client_uri : null;
    const [row] = await mcpDb()<ClientRow[]>`
      insert into public.mcp_clients
        (client_id, kind, client_name, client_uri, redirect_uris, token_endpoint_auth_method, fetched_at)
      values (${clientId}, 'metadata', ${doc.client_name ?? null}, ${clientUri},
              ${doc.redirect_uris}, 'none', now())
      on conflict (client_id) do update
        set client_name = excluded.client_name, client_uri = excluded.client_uri,
            redirect_uris = excluded.redirect_uris, fetched_at = excluded.fetched_at
      returning client_id, kind, client_name, client_uri, redirect_uris,
                token_endpoint_auth_method, secret_hash, fetched_at`;
    return row ? toClient(row) : null;
  } catch {
    return null;
  }
}

const registrationSchema = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().trim().max(200).optional(),
  client_uri: z.string().max(2048).optional(),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post", "client_secret_basic"])
    .default("none"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

/** Dynamic Client Registration (RFC 7591). */
export async function registerClient(
  input: unknown,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; failure: OAuthFailure }> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, failure: fail("invalid_client_metadata", "redirect_uris is required") };
  const meta = parsed.data;
  if (!meta.redirect_uris.every(validRedirectUri))
    return { ok: false, failure: fail("invalid_redirect_uri", "A redirect URI is not allowed") };
  const grants = meta.grant_types ?? ["authorization_code", "refresh_token"];
  if (!grants.every((grant) => grant === "authorization_code" || grant === "refresh_token"))
    return { ok: false, failure: fail("invalid_client_metadata", "Unsupported grant type") };
  if (meta.response_types && !meta.response_types.every((type) => type === "code"))
    return { ok: false, failure: fail("invalid_client_metadata", "Unsupported response type") };

  const clientId = `sxd_client_${randomBytes(16).toString("base64url")}`;
  const clientSecret = meta.token_endpoint_auth_method === "none" ? null : secret(TOKEN_PREFIX.secret);
  const clientUri = meta.client_uri && /^https:\/\//.test(meta.client_uri) ? meta.client_uri : null;
  const db = mcpDb();
  await db`
    insert into public.mcp_clients
      (client_id, kind, client_name, client_uri, redirect_uris, token_endpoint_auth_method, secret_hash)
    values (${clientId}, 'registered', ${meta.client_name || null}, ${clientUri},
            ${meta.redirect_uris}, ${meta.token_endpoint_auth_method},
            ${clientSecret ? hashToken(clientSecret) : null})`;
  // Registrations nobody connected with are forgotten after a month.
  await db`
    delete from public.mcp_clients c
     where c.kind = 'registered' and c.created_at < now() - interval '30 days'
       and not exists (select 1 from public.mcp_tokens t where t.client_id = c.client_id)`;
  return {
    ok: true,
    body: {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_name: meta.client_name,
      client_uri: clientUri ?? undefined,
      redirect_uris: meta.redirect_uris,
      grant_types: grants,
      response_types: ["code"],
      token_endpoint_auth_method: meta.token_endpoint_auth_method,
    },
  };
}

function sameSecret(given: string, hash: string): boolean {
  const a = Buffer.from(hashToken(given), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The client of a token request: public clients send only their id, confidential ones a secret. */
export async function authenticateClient(
  form: URLSearchParams,
  authorization: string | null,
): Promise<McpClient | OAuthFailure> {
  let clientId = form.get("client_id");
  let clientSecret = form.get("client_secret");
  const basic = authorization?.match(/^Basic\s+(.+)$/i);
  if (basic) {
    const decoded = Buffer.from(basic[1]!, "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon > 0) {
      clientId = decodeURIComponent(decoded.slice(0, colon));
      clientSecret = decodeURIComponent(decoded.slice(colon + 1));
    }
  }
  if (!clientId) return fail("invalid_client", "client_id is required", 401);
  const client = await findClient(clientId);
  if (!client) return fail("invalid_client", "Unknown client", 401);
  if (client.authMethod !== "none") {
    if (!clientSecret || !client.secretHash || !sameSecret(clientSecret, client.secretHash))
      return fail("invalid_client", "Client authentication failed", 401);
  }
  return client;
}

/** After the member's consent: a one-time code for the client's redirect. */
export async function createAuthCode(input: {
  clientId: string;
  organizationId: string;
  userId: string;
  scopes: McpScope[];
  redirectUri: string;
  codeChallenge: string;
  resource: string;
}): Promise<string> {
  const code = secret(TOKEN_PREFIX.code);
  const db = mcpDb();
  await db`
    insert into public.mcp_auth_codes
      (code_hash, client_id, organization_id, user_id, scopes, redirect_uri, code_challenge,
       resource, expires_at)
    values (${hashToken(code)}, ${input.clientId}, ${input.organizationId}, ${input.userId},
            ${input.scopes}, ${input.redirectUri}, ${input.codeChallenge}, ${input.resource},
            now() + ${`${AUTH_CODE_TTL} seconds`}::interval)`;
  await db`delete from public.mcp_auth_codes where expires_at < now() - interval '1 day'`;
  return code;
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

function tokenResponse(access: string, refresh: string, scopes: string[]): TokenResponse {
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

const interval = (seconds: number) => `${seconds} seconds`;

/** authorization_code grant. A code used twice revokes what the first use issued. */
export async function exchangeCode(input: {
  client: McpClient;
  code: string;
  verifier: string;
  redirectUri: string | null;
  resource: string | null;
}): Promise<TokenResponse | OAuthFailure> {
  const access = secret(TOKEN_PREFIX.access);
  const refresh = secret(TOKEN_PREFIX.refresh);
  return mcpDb().begin(async (tx) => {
    const [row] = await tx<
      {
        client_id: string;
        organization_id: string;
        user_id: string;
        scopes: string[];
        redirect_uri: string;
        code_challenge: string;
        resource: string;
        expired: boolean;
        used_at: Date | null;
        token_id: string | null;
        client_name: string | null;
      }[]
    >`
      select a.client_id, a.organization_id, a.user_id, a.scopes, a.redirect_uri, a.code_challenge,
             a.resource, a.expires_at < now() as expired, a.used_at, a.token_id, c.client_name
        from public.mcp_auth_codes a
        join public.mcp_clients c on c.client_id = a.client_id
       where a.code_hash = ${hashToken(input.code)}
         for update of a`;
    if (!row) return fail("invalid_grant", "Unknown authorization code");
    if (row.used_at) {
      if (row.token_id)
        await tx`update public.mcp_tokens set revoked_at = coalesce(revoked_at, now()) where id = ${row.token_id}`;
      return fail("invalid_grant", "The authorization code was already used");
    }
    if (row.expired) return fail("invalid_grant", "The authorization code expired");
    if (row.client_id !== input.client.clientId)
      return fail("invalid_grant", "The code was issued to another client");
    if (input.redirectUri !== row.redirect_uri)
      return fail("invalid_grant", "redirect_uri does not match the authorization request");
    if (!verifyPkce(input.verifier, row.code_challenge))
      return fail("invalid_grant", "PKCE verification failed");
    if (input.resource && !ourResource(input.resource, row.resource))
      return fail("invalid_target", "The resource does not match the authorization request");

    const [token] = await tx<{ id: string }[]>`
      insert into public.mcp_tokens
        (organization_id, user_id, kind, client_id, name, scopes, access_hash, access_expires_at,
         refresh_hash, expires_at)
      values (${row.organization_id}, ${row.user_id}, 'oauth', ${row.client_id},
              ${row.client_name || "AI assistant"}, ${row.scopes}, ${hashToken(access)},
              now() + ${interval(ACCESS_TOKEN_TTL)}::interval, ${hashToken(refresh)},
              now() + ${interval(REFRESH_TOKEN_TTL)}::interval)
      returning id`;
    await tx`
      update public.mcp_auth_codes set used_at = now(), token_id = ${token!.id}
       where code_hash = ${hashToken(input.code)}`;
    return tokenResponse(access, refresh, row.scopes);
  }) as Promise<TokenResponse | OAuthFailure>;
}

/** refresh_token grant: a new pair; the old refresh token used again revokes the connection. */
export async function refreshTokens(input: {
  client: McpClient;
  refreshToken: string;
  scope: string | null;
  resource: string | null;
  expectedResource: string;
}): Promise<TokenResponse | OAuthFailure> {
  if (input.resource && !ourResource(input.resource, input.expectedResource))
    return fail("invalid_target", "Tokens are issued only for this server");
  const access = secret(TOKEN_PREFIX.access);
  const refresh = secret(TOKEN_PREFIX.refresh);
  const hash = hashToken(input.refreshToken);
  return mcpDb().begin(async (tx) => {
    const [row] = await tx<
      { id: string; client_id: string | null; scopes: string[]; revoked: boolean; expired: boolean }[]
    >`
      select id, client_id, scopes, revoked_at is not null as revoked, expires_at < now() as expired
        from public.mcp_tokens where refresh_hash = ${hash} for update`;
    if (!row) {
      const [reused] = await tx<{ id: string }[]>`
        update public.mcp_tokens set revoked_at = coalesce(revoked_at, now())
         where previous_refresh_hash = ${hash} returning id`;
      return fail(
        "invalid_grant",
        reused ? "The refresh token was already used; the connection is revoked" : "Unknown refresh token",
      );
    }
    if (row.revoked) return fail("invalid_grant", "The connection was revoked");
    if (row.expired) return fail("invalid_grant", "The connection expired; connect again");
    if (row.client_id !== input.client.clientId)
      return fail("invalid_grant", "The token was issued to another client");
    // A refresh may narrow the scopes, never widen them.
    let scopes = row.scopes;
    if (input.scope) {
      const asked = input.scope.split(/\s+/).filter(isScope);
      if (asked.some((scope) => !row.scopes.includes(scope)))
        return fail("invalid_scope", "A refresh can't add scopes");
      scopes = asked.includes(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
    }
    await tx`
      update public.mcp_tokens
         set access_hash = ${hashToken(access)},
             access_expires_at = now() + ${interval(ACCESS_TOKEN_TTL)}::interval,
             previous_refresh_hash = refresh_hash,
             refresh_hash = ${hashToken(refresh)},
             scopes = ${scopes},
             expires_at = now() + ${interval(REFRESH_TOKEN_TTL)}::interval
       where id = ${row.id}`;
    return tokenResponse(access, refresh, scopes);
  }) as Promise<TokenResponse | OAuthFailure>;
}

/** Token revocation (RFC 7009): an access or refresh token ends its whole connection. */
export async function revokeToken(token: string, client: McpClient): Promise<void> {
  const hash = hashToken(token);
  await mcpDb()`
    update public.mcp_tokens set revoked_at = coalesce(revoked_at, now())
     where (access_hash = ${hash} or refresh_hash = ${hash}) and client_id = ${client.clientId}`;
}

/** A personal token: shown once, for people who configure their assistant by hand. */
export async function createPersonalToken(input: {
  organizationId: string;
  userId: string;
  name: string;
  scopes: McpScope[];
  days: number;
}): Promise<{ id: string; token: string }> {
  const token = secret(TOKEN_PREFIX.personal);
  const [row] = await mcpDb()<{ id: string }[]>`
    insert into public.mcp_tokens
      (organization_id, user_id, kind, name, scopes, access_hash, access_expires_at, expires_at)
    values (${input.organizationId}, ${input.userId}, 'personal', ${input.name}, ${input.scopes},
            ${hashToken(token)}, now() + ${`${input.days} days`}::interval,
            now() + ${`${input.days} days`}::interval)
    returning id`;
  return { id: row!.id, token };
}

export type McpPrincipal = {
  tokenId: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  /** The token's scopes as the company allows them now: writing only while the owner allows it. */
  scopes: McpScope[];
  clientName: string;
  kind: "oauth" | "personal";
  expiresAt: number;
};

export type PrincipalResult =
  | { ok: true; principal: McpPrincipal }
  | { ok: false; reason: "invalid" | "disabled" };

/**
 * Who an access token speaks for, checked on every call: not revoked, not
 * expired, still a member, and MCP still on for the company.
 */
export async function principalForToken(token: string): Promise<PrincipalResult> {
  if (!token.startsWith(TOKEN_PREFIX.access) && !token.startsWith(TOKEN_PREFIX.personal))
    return { ok: false, reason: "invalid" };
  const db = mcpDb();
  const [row] = await db<
    {
      id: string;
      organization_id: string;
      user_id: string;
      role: MemberRole;
      scopes: string[];
      name: string;
      kind: "oauth" | "personal";
      access_expires_at: Date;
      mcp_enabled: boolean;
      mcp_write_enabled: boolean;
      stale: boolean;
    }[]
  >`
    select t.id, t.organization_id, t.user_id, m.role, t.scopes, t.name, t.kind,
           t.access_expires_at, o.mcp_enabled, o.mcp_write_enabled,
           coalesce(t.last_used_at < now() - interval '1 minute', true) as stale
      from public.mcp_tokens t
      join public.memberships m on m.organization_id = t.organization_id and m.user_id = t.user_id
      join public.organizations o on o.id = t.organization_id
     where t.access_hash = ${hashToken(token)}
       and t.revoked_at is null
       and t.access_expires_at > now()
       and t.expires_at > now()`;
  if (!row) return { ok: false, reason: "invalid" };
  if (!row.mcp_enabled) return { ok: false, reason: "disabled" };
  if (row.stale) await db`update public.mcp_tokens set last_used_at = now() where id = ${row.id}`;
  const scopes: McpScope[] =
    row.scopes.includes(SCOPE_WRITE) && row.mcp_write_enabled ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  return {
    ok: true,
    principal: {
      tokenId: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      scopes,
      clientName: row.name,
      kind: row.kind,
      expiresAt: Math.floor(row.access_expires_at.getTime() / 1000),
    },
  };
}
