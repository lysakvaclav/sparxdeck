// AI assistants over MCP (part 31): the fixed rules in one place. Pure values,
// shared by the endpoint, the OAuth server, the settings page and the tests.

export const SCOPE_READ = "sparxdeck:read";
export const SCOPE_WRITE = "sparxdeck:write";
export const SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;
export type McpScope = (typeof SCOPES)[number];

/** The MCP endpoint's path; its full URL is the OAuth resource identifier (RFC 8707). */
export const MCP_PATH = "/api/mcp";

/** Lifetimes, in seconds. */
export const ACCESS_TOKEN_TTL = 60 * 60;
export const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;
export const AUTH_CODE_TTL = 10 * 60;
export const CONFIRMATION_TTL = 10 * 60;
/** A personal token lasts the chosen number of days, at most a year. */
export const PERSONAL_TOKEN_DAYS = [30, 90, 365] as const;

/** Calls per token. */
export const RATE_PER_MINUTE = 60;
export const RATE_PER_DAY = 2000;

/** Items per page of a list tool: the default and the most a caller may ask for. */
export const PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Prefixes make a leaked secret recognisable (and searchable by secret scanners). */
export const TOKEN_PREFIX = {
  access: "sxd_at_",
  refresh: "sxd_rt_",
  personal: "sxd_pat_",
  code: "sxd_ac_",
  secret: "sxd_cs_",
} as const;

export function mcpResourceUrl(appUrl: string): string {
  return new URL(MCP_PATH, appUrl).toString();
}
