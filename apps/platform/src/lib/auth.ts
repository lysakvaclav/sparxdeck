import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, MemberRole } from "@/lib/supabase/database.types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Membership = Database["public"]["Tables"]["memberships"]["Row"];

export const MANAGER_ROLES: readonly MemberRole[] = ["owner", "admin"];

/** The signed-in user, validated with Supabase. Cached for the duration of a request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The user's active organization. In the MVP a user belongs to one organization;
 * the earliest membership wins if there are more.
 */
export const getActiveMembership = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.organization) return null;
  const { organization, ...membership } = data;
  return { membership: membership as Membership, organization: organization as Organization };
});

/** For pages inside the app: requires a session and an organization. */
export async function requireMembership() {
  await requireUser();
  const active = await getActiveMembership();
  if (!active) redirect("/onboarding");
  return active;
}

export function isManager(role: MemberRole) {
  return MANAGER_ROLES.includes(role);
}

/** For server actions: the active membership if the user is an owner or admin, else null. */
export async function requireManager() {
  const active = await getActiveMembership();
  return active && isManager(active.membership.role) ? active : null;
}
