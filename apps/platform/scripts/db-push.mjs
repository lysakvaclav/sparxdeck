// Applies supabase/migrations to a database. Uses the connection string directly,
// so neither Docker nor `supabase login` is needed.
//
//   npm run db:push                 development: SUPABASE_DB_URL (.env.local)
//   npm run db:push:production      production: SUPABASE_DB_URL (.env.prod.local),
//                                   after you type the project's reference to confirm
//
// Extra arguments go to `supabase db push` (e.g. --dry-run to list pending migrations).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const production = process.argv.includes("--production");
const args = process.argv.slice(2).filter((arg) => arg !== "--production");
const source = production ? ".env.prod.local" : ".env.local";
const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    `SUPABASE_DB_URL is missing in ${source} (Supabase dashboard -> Connect -> Session pooler).`,
  );
  process.exit(1);
}

// The project reference: pooler user postgres.<ref>, or direct host db.<ref>.supabase.co
let project = "unknown";
try {
  const url = new URL(dbUrl);
  project =
    decodeURIComponent(url.username).split(".")[1] ??
    url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ??
    url.hostname;
} catch {
  console.error("SUPABASE_DB_URL is not a valid connection string.");
  process.exit(1);
}

if (production && !args.includes("--dry-run")) {
  console.log(`\nPRODUCTION database, project ${project}. Back it up first if this is risky.`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Type the project reference (${project}) to continue: `);
  prompt.close();
  if (answer.trim() !== project) {
    console.error("Not confirmed, nothing was changed.");
    process.exit(1);
  }
}

// Run the CLI's JS entry point with Node directly: no shell, so passwords with
// special characters in the connection string are passed through untouched.
const require = createRequire(import.meta.url);
const cli = path.join(
  path.dirname(require.resolve("supabase/package.json")),
  "dist",
  "supabase.js",
);

const result = spawnSync(process.execPath, [cli, "db", "push", "--db-url", dbUrl, ...args], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
