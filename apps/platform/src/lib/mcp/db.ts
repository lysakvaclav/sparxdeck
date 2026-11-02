import "server-only";
import postgres from "postgres";

// The MCP server talks to Postgres directly (Supabase's transaction pooler),
// so each tool call can run as the member it acts for: role "authenticated"
// and their id in the JWT claims that auth.uid() reads. Row Level Security
// and the write functions then apply exactly as in the app. The same
// connection, as the database owner, keeps the server's own bookkeeping
// (tokens, codes, audit), which clients can never reach.

let client: postgres.Sql | undefined;

function databaseUrl(): string {
  const pooled = process.env.DATABASE_POOLER_URL;
  if (pooled) return pooled;
  // Locally the session pooler URL used for migrations; port 6543 is the
  // transaction pooler on the same host.
  const session = process.env.SUPABASE_DB_URL;
  if (session) return session.replace(/:5432\//, ":6543/");
  throw new Error("DATABASE_POOLER_URL is not set. See apps/platform/.env.example.");
}

/** The server's own connection (database owner: no RLS). Only for MCP bookkeeping. */
export function mcpDb(): postgres.Sql {
  client ??= postgres(databaseUrl(), {
    // The transaction pooler can't keep prepared statements.
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
  return client;
}

export type Member = { userId: string; organizationId: string };
export type Tx = postgres.TransactionSql;

/**
 * Runs fn in one transaction as the member: their RLS, their role checks.
 * Settings are local to the transaction, so the pooled connection is clean
 * again afterwards.
 */
export async function asMember<T>(member: Member, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: member.userId, role: "authenticated" });
  const result = await mcpDb().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`set local role authenticated`;
    await tx`set local statement_timeout = '10s'`;
    return fn(tx);
  });
  return result as T;
}
