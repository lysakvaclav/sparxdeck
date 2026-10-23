import { getFormatter, getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { digestRecipients, organizationDigest } from "@/lib/digests";
import { emailEnabled } from "@/lib/email";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];

/**
 * Who gets the weekly summary and what it would say this week, built the same
 * way as the Monday job (with the viewer's own access).
 */
export async function DigestPreview({ organization }: { organization: Organization }) {
  const t = await getTranslations("settings.digest");
  const format = await getFormatter();
  const supabase = await createClient();
  const [digest, recipients, { data: last }] = await Promise.all([
    organizationDigest(supabase, organization),
    digestRecipients(supabase, organization.id),
    supabase
      .from("organization_digests")
      .select("sent_at, recipients")
      .eq("organization_id", organization.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="mt-4 space-y-4 border-t pt-4" data-testid="digest-preview">
      {!emailEnabled() && organization.weekly_digest && (
        <Alert variant="warning">{t("emailDisabled")}</Alert>
      )}
      <div className="space-y-1">
        <p className="text-ui font-medium">{t("recipients")}</p>
        <ul className="text-ui text-muted-foreground">
          {recipients.map((recipient) => (
            <li key={recipient.email} className="break-words">
              {recipient.display_name} · {recipient.email}
            </li>
          ))}
        </ul>
        {last && (
          <p className="text-ui-sm text-muted-foreground">
            {t("lastSent", {
              date: format.dateTime(new Date(last.sent_at), { dateStyle: "medium" }),
              count: last.recipients,
            })}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-ui font-medium">{t("previewTitle")}</p>
        {digest ? (
          <div className="space-y-2 rounded-md bg-muted p-5 text-ui">
            <p className="text-ui-sm text-muted-foreground">
              {t("subject")}: <span className="text-foreground">{digest.subject}</span>
            </p>
            <p className="font-semibold">{digest.heading}</p>
            <p>{digest.body}</p>
            {digest.items.length > 0 && (
              <ul className="list-disc space-y-0.5 ps-5">
                {digest.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <p className="text-ui-sm text-muted-foreground">{digest.footnote}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("previewEmpty")}</p>
        )}
      </div>
    </div>
  );
}
