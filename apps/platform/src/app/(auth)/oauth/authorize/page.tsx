import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/app/auth-heading";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { AUTHORIZE_FIELDS, checkAuthorizeRequest, type AuthorizeParams } from "@/lib/mcp/authorize";
import { SCOPE_WRITE } from "@/lib/mcp/config";
import { createClient } from "@/lib/supabase/server";
import { answerAuthorization } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mcp.consent");
  return { title: t("title") };
}

type Company = { id: string; name: string; mcp_enabled: boolean; mcp_write_enabled: boolean };

/**
 * Consent for an AI assistant (OAuth authorization, part 31): who asks, where
 * the answer goes, which company, reading only or also changes. Nothing
 * happens without the member pressing Allow.
 */
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<AuthorizeParams> }) {
  const params = await searchParams;
  const t = await getTranslations("mcp.consent");
  const check = await checkAuthorizeRequest(params);
  if (check.kind === "redirect") redirect(check.url);
  if (check.kind === "page")
    return (
      <>
        <AuthHeading title={t("errorTitle")} subtitle={t(`errors.${check.error}`)} />
        <Button asChild variant="outline" className="w-full">
          <Link href="/">{t("back")}</Link>
        </Button>
      </>
    );

  const { request } = check;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("organization:organizations(id, name, mcp_enabled, mcp_write_enabled)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const companies = (data ?? [])
    .map((row) => row.organization as Company | null)
    .filter((company): company is Company => Boolean(company));
  const enabled = companies.filter((company) => company.mcp_enabled);

  const clientName = request.client.clientName || t("unknownClient");
  const returnUrl = new URL(request.redirectUri);
  const returnTo = returnUrl.host || returnUrl.protocol.replace(/:$/, "");
  const wantsWrite = request.scopes.includes(SCOPE_WRITE);
  const hidden = AUTHORIZE_FIELDS.map((key) => {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text ? <input key={key} type="hidden" name={key} value={text} /> : null;
  });

  if (!enabled.length)
    return (
      <>
        <AuthHeading title={t("disabledTitle")} subtitle={t("disabledBody")} />
        <form action={answerAuthorization}>
          {hidden}
          <Button type="submit" name="decision" value="deny" variant="outline" className="w-full">
            {t("cancel")}
          </Button>
        </form>
      </>
    );

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle", { client: clientName })} />
      <form action={answerAuthorization} className="space-y-6">
        {hidden}
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">{clientName}</p>
          <p className="mt-1 text-muted-foreground">{t("returnsTo", { host: returnTo })}</p>
        </div>

        {enabled.length > 1 ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("company")}</legend>
            {enabled.map((company, index) => (
              <label
                key={company.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm"
              >
                <input type="radio" name="organization_id" value={company.id} defaultChecked={index === 0} />
                <span className="flex-1">{company.name}</span>
                <span className="text-muted-foreground">
                  {company.mcp_write_enabled ? t("companyWrite") : t("companyRead")}
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <input type="hidden" name="organization_id" value={enabled[0]!.id} />
        )}

        <div className="space-y-2 text-sm">
          <p className="font-medium">{t("canTitle")}</p>
          <ul className="list-disc space-y-1.5 ps-5 text-muted-foreground">
            <li>{t("canRead")}</li>
            {wantsWrite && <li>{t("canWrite")}</li>}
            <li>{t("never")}</li>
          </ul>
        </div>

        {wantsWrite &&
          (enabled.some((company) => company.mcp_write_enabled) ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="allow_write" className="mt-1" />
              <span>
                {t("allowWrite")}
                <span className="block text-muted-foreground">{t("allowWriteHint")}</span>
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">{t("writeNotAllowed")}</p>
          ))}

        <div className="grid gap-3">
          <Button type="submit" name="decision" value="allow" className="w-full">
            {t("allow")}
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline" className="w-full">
            {t("deny")}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">{t("revokeHint")}</p>
      </form>
    </>
  );
}
