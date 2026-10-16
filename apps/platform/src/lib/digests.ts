import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { buildDigest, weekStart, type Digest, type Translate } from "@/lib/digest";
import { addDays, todayInTimeZone } from "@/lib/due";
import { emailEnabled, renderEmail, sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";

// The weekly summary: loaded with any client (the user's for the preview in
// Settings, the service role for the Monday job) and sent to owners and admins.

type Client = SupabaseClient<Database>;
type Organization = Pick<
  Database["public"]["Tables"]["organizations"]["Row"],
  "id" | "name" | "timezone" | "due_soon_days" | "default_locale"
>;

/** This week's summary for an organization, or null when there is nothing to report. */
export async function organizationDigest(
  client: Client,
  organization: Organization,
  now: Date = new Date(),
): Promise<Digest | null> {
  const today = todayInTimeZone(organization.timezone, now);
  const until = addDays(today, organization.due_soon_days);
  const count = { count: "exact", head: true } as const;
  const openDefects = (severity: "critical" | "major") =>
    client
      .from("defects")
      .select("id", count)
      .eq("organization_id", organization.id)
      .eq("severity", severity)
      .neq("status", "resolved");

  const [devices, never, critical, major] = await Promise.all([
    fetchAll((from, to) =>
      client
        .from("devices")
        .select("id, next_due_on, site:sites!inner(id, name, customer:customers(name))")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .eq("status", "active")
        .lte("next_due_on", until)
        .order("id")
        .range(from, to),
    ),
    client
      .from("devices")
      .select("id", count)
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .eq("status", "active")
      .is("next_due_on", null),
    openDefects("critical"),
    openDefects("major"),
  ]);

  const locale = organization.default_locale === "en" ? "en" : "cs";
  const t = (await getTranslations({ locale, namespace: "digest" })) as unknown as Translate;
  return buildDigest(
    {
      locale,
      organizationName: organization.name,
      today,
      soonDays: organization.due_soon_days,
      devices: devices.map((device) => ({
        siteId: device.site.id,
        siteName: device.site.name,
        customerName: device.site.customer?.name ?? null,
        nextDueOn: device.next_due_on,
      })),
      never: never.count ?? 0,
      defects: { critical: critical.count ?? 0, major: major.count ?? 0 },
      appUrl: serverEnv().NEXT_PUBLIC_APP_URL,
    },
    t,
  );
}

/** Who gets the summary: the organization's owners and admins. */
export async function digestRecipients(client: Client, organizationId: string) {
  const { data } = await client
    .from("memberships")
    .select("email, display_name")
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin"])
    .order("email");
  return data ?? [];
}

export type DigestRun = {
  organization: string;
  week: string;
  status: "sent" | "nothing" | "already" | "disabled" | "no-email" | "failed" | "preview";
  recipients: number;
  subject?: string;
};

/**
 * The Monday job: for every organization with the summary on, claims its week
 * (so a retried run doesn't send twice) and e-mails owners and admins. With
 * `dryRun` it only reports what it would send.
 */
export async function runWeeklyDigests({
  dryRun = false,
  now = new Date(),
}: { dryRun?: boolean; now?: Date } = {}): Promise<DigestRun[]> {
  const admin = createAdminClient();
  const { data: organizations } = await admin
    .from("organizations")
    .select("id, name, timezone, due_soon_days, default_locale, weekly_digest")
    .order("created_at");
  const runs: DigestRun[] = [];

  for (const organization of organizations ?? []) {
    const week = weekStart(todayInTimeZone(organization.timezone, now));
    const run = (status: DigestRun["status"], recipients = 0, subject?: string) =>
      runs.push({ organization: organization.id, week, status, recipients, subject });
    if (!organization.weekly_digest) {
      run("disabled");
      continue;
    }
    try {
      const [digest, recipients] = await Promise.all([
        organizationDigest(admin, organization, now),
        digestRecipients(admin, organization.id),
      ]);
      if (!digest || recipients.length === 0) {
        run("nothing");
        continue;
      }
      if (dryRun) {
        run("preview", recipients.length, digest.subject);
        continue;
      }
      if (!emailEnabled()) {
        run("no-email", recipients.length, digest.subject);
        continue;
      }
      // Claim the week first: a second run finds it taken and sends nothing.
      const { error: claimed } = await admin
        .from("organization_digests")
        .insert({ organization_id: organization.id, week, recipients: recipients.length });
      if (claimed) {
        run("already");
        continue;
      }
      const { html, text } = renderEmail(digest);
      let sent = 0;
      for (const recipient of recipients) {
        if (await sendEmail({ to: recipient.email, subject: digest.subject, html, text })) sent++;
      }
      if (sent === 0) {
        // Nothing went out: release the week so the next run can try again.
        await admin
          .from("organization_digests")
          .delete()
          .eq("organization_id", organization.id)
          .eq("week", week);
        run("failed", recipients.length, digest.subject);
        continue;
      }
      if (sent < recipients.length)
        await admin
          .from("organization_digests")
          .update({ recipients: sent })
          .eq("organization_id", organization.id)
          .eq("week", week);
      run("sent", sent, digest.subject);
    } catch (error) {
      console.error("Weekly summary failed", organization.id, error);
      run("failed");
    }
  }
  return runs;
}
