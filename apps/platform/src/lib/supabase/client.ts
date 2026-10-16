"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublicEnv } from "./public-env";

/** Supabase client for Client Components. Acts as the signed-in user (RLS applies). */
export function createClient() {
  const { url, anonKey } = supabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
