import "server-only";
import { z } from "zod";

// Validated once, on first use, so a missing key fails loudly with its name
// instead of surfacing as an obscure Supabase error.
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("SparxDeck <noreply@sparxdeck.com>"),
  // Scheduled jobs (/api/cron/*) must send "Authorization: Bearer <CRON_SECRET>".
  CRON_SECRET: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(
        `Invalid or missing environment variables: ${missing}. See apps/platform/.env.example.`,
      );
    }
    cached = {
      ...parsed.data,
      RESEND_API_KEY: parsed.data.RESEND_API_KEY || undefined,
      CRON_SECRET: parsed.data.CRON_SECRET || undefined,
    };
  }
  return cached;
}
