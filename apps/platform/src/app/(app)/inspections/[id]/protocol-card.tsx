import { getFormatter, getTranslations } from "next-intl/server";
import { DocumentOpenIcon, DownloadIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emailEnabled } from "@/lib/email";
import { memberNames } from "@/lib/inspection-data";
import { protocolNumber } from "@/lib/protocol";
import { protocolOf } from "@/lib/protocols";
import { createClient } from "@/lib/supabase/server";
import { GenerateProtocolButton, SendProtocolButton } from "./protocol-controls";

/**
 * The completed inspection's protocol: download, print, e-mail (to the customer
 * by default) and where it was sent. Offers to create the PDF if it is missing.
 */
export async function ProtocolCard({
  inspectionId,
  organizationId,
  customerEmail,
  className,
}: {
  inspectionId: string;
  organizationId: string;
  customerEmail: string | null;
  className?: string;
}) {
  const t = await getTranslations("protocol.card");
  const format = await getFormatter();
  const protocol = await protocolOf(inspectionId);
  const supabase = await createClient();
  const [{ data: emails }, names] = await Promise.all([
    protocol
      ? supabase
          .from("protocol_emails")
          .select("id, recipient, sent_by, sent_at")
          .eq("protocol_id", protocol.id)
          .order("sent_at")
      : Promise.resolve({ data: [] }),
    memberNames(organizationId),
  ]);
  const href = `/inspections/${inspectionId}/protocol`;
  const number = protocol ? protocolNumber(protocol.year, protocol.number) : null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      {protocol?.pdf_path && protocol.generated_at ? (
        <CardContent className="space-y-[15px]">
          <div>
            <p className="font-mono text-[22px] leading-7 font-semibold tabular-nums">{number}</p>
            <p className="text-ui-sm text-muted-foreground">
              {t("issued", {
                date: format.dateTime(new Date(protocol.generated_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
            {/* Plain links: the route answers with a redirect to the file. */}
            <Button asChild>
              <a href={href} data-testid="protocol-download">
                <DownloadIcon />
                {t("download")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${href}?inline`} target="_blank" rel="noreferrer">
                <DocumentOpenIcon />
                {t("open")}
              </a>
            </Button>
            <SendProtocolButton
              protocolId={protocol.id}
              defaultEmail={customerEmail}
              enabled={emailEnabled()}
            />
          </div>
          {emails && emails.length > 0 && (
            <div className="space-y-1">
              <p className="text-ui-sm font-medium text-muted-foreground">{t("sentList")}</p>
              <ul className="space-y-0.5 text-ui-sm">
                {emails.map((email) => (
                  <li key={email.id} className="break-words">
                    {t("sentEntry", {
                      email: email.recipient,
                      date: format.dateTime(new Date(email.sent_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                      name: (email.sent_by && names.get(email.sent_by)) || "—",
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      ) : (
        <CardContent className="space-y-[15px]">
          {protocol ? (
            <Alert variant="warning" title={t("missingTitle")}>
              <p>{t("missingBody")}</p>
            </Alert>
          ) : (
            <p className="text-muted-foreground">{t("legacyBody")}</p>
          )}
          <GenerateProtocolButton inspectionId={inspectionId} />
        </CardContent>
      )}
    </Card>
  );
}
