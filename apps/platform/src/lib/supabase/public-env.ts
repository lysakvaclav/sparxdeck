// Public values are inlined by Next.js at build time, so they must be read with
// literal property access (process.env.NEXT_PUBLIC_*), not through a helper.
export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See apps/platform/.env.example.",
    );
  }
  return { url, anonKey: publishableKey };
}
