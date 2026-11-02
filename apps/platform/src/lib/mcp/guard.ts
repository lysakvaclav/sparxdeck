import "server-only";
import { hashToken } from "@/lib/tokens";
import { CONFIRMATION_TTL, RATE_PER_DAY, RATE_PER_MINUTE } from "./config";
import { mcpDb } from "./db";
import type { McpPrincipal } from "./oauth";
import { auditParams, canonicalJson } from "./output";

// The safety catches around MCP calls (part 31): how often a token may call,
// the audit log, and the one-time confirmation every write needs.

/** Counts the call; past the minute's or the day's limit, how long to wait. */
export async function hitRate(
  tokenId: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number; first: boolean }> {
  const db = mcpDb();
  const count = async (period: "minute" | "day", length: string) => {
    const [row] = await db<{ calls: number; wait: number }[]>`
      insert into public.mcp_rate as r (token_id, period, started_at, calls)
      values (${tokenId}, ${period}, now(), 1)
      on conflict (token_id, period) do update
        set started_at = case when r.started_at < now() - ${length}::interval then now() else r.started_at end,
            calls = case when r.started_at < now() - ${length}::interval then 1 else r.calls + 1 end
      returning calls,
        greatest(1, ceil(extract(epoch from (started_at + ${length}::interval - now()))))::int as wait`;
    return row!;
  };
  const minute = await count("minute", "1 minute");
  // first: the call that crossed the limit (audited once, not every refused call).
  if (minute.calls > RATE_PER_MINUTE)
    return { ok: false, retryAfter: minute.wait, first: minute.calls === RATE_PER_MINUTE + 1 };
  const day = await count("day", "1 day");
  if (day.calls > RATE_PER_DAY) return { ok: false, retryAfter: day.wait, first: day.calls === RATE_PER_DAY + 1 };
  return { ok: true };
}

export async function recordAudit(entry: {
  principal: McpPrincipal;
  method: string;
  name?: string | null;
  params?: unknown;
  outcome: "ok" | "error" | "denied" | "rate_limited";
  errorCode?: string | null;
  durationMs?: number;
}): Promise<void> {
  const params = entry.params === undefined ? null : auditParams(entry.params);
  try {
    await mcpDb()`
      insert into public.mcp_audit
        (organization_id, user_id, token_id, client_name, method, name, params, outcome, error_code, duration_ms)
      values (${entry.principal.organizationId}, ${entry.principal.userId}, ${entry.principal.tokenId},
              ${entry.principal.clientName.slice(0, 200)}, ${entry.method.slice(0, 100)},
              ${entry.name?.slice(0, 300) ?? null}, ${params === null ? null : mcpDb().json(params as never)},
              ${entry.outcome}, ${entry.errorCode?.slice(0, 100) ?? null}, ${entry.durationMs ?? null})`;
  } catch (error) {
    // The answer still goes out; a lost audit row is reported, not fatal.
    console.error("mcp audit failed", error);
  }
}

/** The arguments a confirmation is bound to: everything but the confirmation itself. */
export function confirmationHash(tool: string, args: Record<string, unknown>): string {
  const rest = Object.fromEntries(Object.entries(args).filter(([key]) => key !== "confirmation"));
  return hashToken(`${tool}\n${canonicalJson(rest)}`);
}

export async function createConfirmation(tokenId: string, tool: string, hash: string): Promise<string> {
  const db = mcpDb();
  const [row] = await db<{ id: string }[]>`
    insert into public.mcp_confirmations (token_id, tool, params_hash, expires_at)
    values (${tokenId}, ${tool}, ${hash}, now() + ${`${CONFIRMATION_TTL} seconds`}::interval)
    returning id`;
  await db`delete from public.mcp_confirmations where expires_at < now() - interval '1 day'`;
  return row!.id;
}

/** Uses a confirmation up: only once, only for this token, tool and these exact arguments. */
export async function consumeConfirmation(
  tokenId: string,
  tool: string,
  hash: string,
  id: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await mcpDb()`
    update public.mcp_confirmations set used_at = now()
     where id = ${id} and token_id = ${tokenId} and tool = ${tool} and params_hash = ${hash}
       and used_at is null and expires_at > now()
    returning id`;
  return rows.length === 1;
}
