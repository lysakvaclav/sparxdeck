import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { SCOPE_WRITE, mcpResourceUrl } from "@/lib/mcp/config";
import { MARKETING_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { CopyField, McpSettingsForm, PersonalTokenForm, RevokeButton } from "./assistants-forms";

/** Now, and a week ago for the usage counts (outside render, which must stay pure). */
function auditWindow() {
  const now = Date.now();
  return { now, since: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mcp.page");
  return { title: t("title") };
}

/**
 * AI assistants over MCP (part 31): the owner's switches, how to connect,
 * connections with revoking, personal tokens and the audit of calls. Members
 * see their own connections and calls; owners and admins the company's.
 */
export default async function AssistantsPage() {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("mcp.page");
  const locale = await getLocale();
  const format = await getFormatter();
  const manager = isManager(membership.role);
  const serverUrl = mcpResourceUrl(serverEnv().NEXT_PUBLIC_APP_URL);
  const supabase = await createClient();
  const { now, since } = auditWindow();

  const auditCount = (outcome: "ok" | "error" | "denied" | "rate_limited") =>
    supabase
      .from("mcp_audit")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("outcome", outcome)
      .gte("created_at", since);

  const [{ data: tokens }, { data: members }, { data: calls }, ok, errors, denied, limited] = await Promise.all([
    supabase
      .from("mcp_tokens")
      .select("id, user_id, kind, name, scopes, created_at, last_used_at, expires_at, revoked_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("memberships").select("user_id, display_name, role").eq("organization_id", organization.id),
    supabase
      .from("mcp_audit")
      .select("id, created_at, user_id, client_name, method, name, outcome, error_code")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(50),
    auditCount("ok"),
    auditCount("error"),
    auditCount("denied"),
    auditCount("rate_limited"),
  ]);
  const nameOf = (userId: string) => members?.find((m) => m.user_id === userId)?.display_name ?? "—";
  const when = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : t("connections.never");
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });

  const tokenState = (token: NonNullable<typeof tokens>[number]) =>
    token.revoked_at ? "stateRevoked" : new Date(token.expires_at).getTime() < now ? "stateExpired" : "stateActive";

  return (
    <>
      <PageHeader
        icon={appIcon("assistants").icon}
        iconClassName={appIcon("assistants").tone}
        title={t("title")}
        actions={
          <Button asChild variant="outline">
            <a href={`${MARKETING_URL}/${locale}/mcp`} target="_blank" rel="noreferrer">
              {t("docs")}
            </a>
          </Button>
        }
      />
      <PageBody>
        <div className="mx-auto grid max-w-[56rem] grid-cols-1 gap-3 sm:gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {t("status.title")}
                <Badge>{organization.mcp_enabled ? t("status.on") : t("status.off")}</Badge>
                {organization.mcp_enabled && (
                  <Badge>{organization.mcp_write_enabled ? t("status.writeOn") : t("status.writeOff")}</Badge>
                )}
              </CardTitle>
              <CardDescription>{t("status.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {membership.role !== "owner" && <Alert>{t("status.ownerOnly")}</Alert>}
              <McpSettingsForm
                disabled={membership.role !== "owner"}
                defaults={{ enabled: organization.mcp_enabled, write: organization.mcp_write_enabled }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("connect.title")}</CardTitle>
              <CardDescription>{t("connect.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-ui">
              <CopyField value={serverUrl} label={t("connect.description")} />
              {!organization.mcp_enabled && <Alert>{t("connect.disabledNote")}</Alert>}
              <div>
                <h3 className="font-semibold">{t("connect.claudeTitle")}</h3>
                <ol className="mt-1.5 list-decimal space-y-1 ps-5">
                  <li>{t("connect.claudeStep1")}</li>
                  <li>{t("connect.claudeStep2")}</li>
                  <li>{t("connect.claudeStep3")}</li>
                </ol>
              </div>
              <div>
                <h3 className="font-semibold">{t("connect.claudeCodeTitle")}</h3>
                <p className="mt-1.5">{t("connect.claudeCodeBody")}</p>
                <div className="mt-2">
                  <CopyField
                    value={`claude mcp add --transport http sparxdeck ${serverUrl}`}
                    label={t("connect.claudeCodeTitle")}
                  />
                </div>
              </div>
              <div>
                <h3 className="font-semibold">{t("connect.chatgptTitle")}</h3>
                <ol className="mt-1.5 list-decimal space-y-1 ps-5">
                  <li>{t("connect.chatgptStep1")}</li>
                  <li>{t("connect.chatgptStep2")}</li>
                  <li>{t("connect.chatgptStep3")}</li>
                </ol>
                <p className="mt-1.5 text-muted-foreground">{t("connect.chatgptNote")}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t("connect.geminiTitle")}</h3>
                <p className="mt-1.5">{t("connect.geminiBody")}</p>
                <div className="mt-2">
                  <CopyField
                    value={JSON.stringify({ mcpServers: { sparxdeck: { httpUrl: serverUrl } } })}
                    label={t("connect.geminiTitle")}
                  />
                </div>
              </div>
              <div>
                <h3 className="font-semibold">{t("connect.otherTitle")}</h3>
                <p className="mt-1.5">{t("connect.otherBody")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{manager ? t("connections.titleAll") : t("connections.title")}</CardTitle>
              <CardDescription>{t("connections.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {tokens?.length ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("connections.name")}</TableHeaderCell>
                      {manager && <TableHeaderCell>{t("connections.person")}</TableHeaderCell>}
                      <TableHeaderCell>{t("connections.access")}</TableHeaderCell>
                      <TableHeaderCell>{t("connections.lastUsed")}</TableHeaderCell>
                      <TableHeaderCell>{t("connections.expires")}</TableHeaderCell>
                      <TableHeaderCell>{t("connections.state")}</TableHeaderCell>
                      <TableHeaderCell>
                        <span className="sr-only">{t("connections.revoke")}</span>
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tokens.map((token) => {
                      const state = tokenState(token);
                      return (
                        <TableRow key={token.id}>
                          <TableCell>
                            <span className="font-medium">{token.name}</span>
                            <span className="block text-muted-foreground">
                              {token.kind === "oauth" ? t("connections.kindOauth") : t("connections.kindPersonal")} ·{" "}
                              {day(token.created_at)}
                            </span>
                          </TableCell>
                          {manager && <TableCell>{nameOf(token.user_id)}</TableCell>}
                          <TableCell>
                            {token.scopes.includes(SCOPE_WRITE) ? t("connections.accessWrite") : t("connections.accessRead")}
                          </TableCell>
                          <TableCell>{when(token.last_used_at)}</TableCell>
                          <TableCell>{day(token.expires_at)}</TableCell>
                          <TableCell>{t(`connections.${state}`)}</TableCell>
                          <TableCell className="text-end">
                            {state === "stateActive" && <RevokeButton id={token.id} name={token.name} />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-ui text-muted-foreground">{t("connections.empty")}</p>
              )}
            </CardContent>
          </Card>

          {organization.mcp_enabled && (
            <Card>
              <CardHeader>
                <CardTitle>{t("token.title")}</CardTitle>
                <CardDescription>{t("token.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <PersonalTokenForm writeAllowed={organization.mcp_write_enabled} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("usage.title")}</CardTitle>
              <CardDescription>{t("usage.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["ok", ok.count],
                    ["errors", errors.count],
                    ["denied", denied.count],
                    ["limited", limited.count],
                  ] as const
                ).map(([key, count]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <dt className="text-ui text-muted-foreground">{t(`usage.${key}`)}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{count ?? 0}</dd>
                  </div>
                ))}
              </dl>
              {calls?.length ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("usage.time")}</TableHeaderCell>
                      {manager && <TableHeaderCell>{t("usage.person")}</TableHeaderCell>}
                      <TableHeaderCell>{t("usage.action")}</TableHeaderCell>
                      <TableHeaderCell>{t("usage.result")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {calls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>{when(call.created_at)}</TableCell>
                        {manager && <TableCell>{nameOf(call.user_id)}</TableCell>}
                        <TableCell>
                          <span className="font-mono text-[0.8125rem]">{call.name ?? call.method}</span>
                          {call.client_name && (
                            <span className="block text-muted-foreground">{call.client_name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {t(`usage.outcome.${call.outcome}`)}
                          {call.error_code && <span className="block text-muted-foreground">{call.error_code}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-ui text-muted-foreground">{t("usage.empty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
