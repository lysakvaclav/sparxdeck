import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { appIcon } from "@/components/app/nav-items";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { isManager, requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { MemberActions } from "./member-actions";
import { RevokeButton } from "./revoke-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("title") };
}

const ROLE_ORDER = { owner: 0, admin: 1, technician: 2 } as const;

export default async function TeamPage() {
  const { membership, organization } = await requireMembership();
  const t = await getTranslations("team");
  const tRoles = await getTranslations("roles");
  const tAuth = await getTranslations("auth");
  const format = await getFormatter();
  const manager = isManager(membership.role);

  const supabase = await createClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, display_name, email, role")
      .eq("organization_id", organization.id)
      .order("created_at"),
    manager
      ? supabase
          .from("invitations")
          .select("id, email, role, expires_at")
          .eq("organization_id", organization.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const sortedMembers = [...(members ?? [])].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
  );

  return (
    <>
      <PageHeader
        icon={appIcon("team").icon}
        iconClassName={appIcon("team").tone}
        title={t("title")}
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("members")}{" "}
                <span className="font-normal text-muted-foreground">({sortedMembers.length})</span>
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>{t("name")}</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">
                    {tAuth("email")}
                  </TableHeaderCell>
                  <TableHeaderCell>{t("role")}</TableHeaderCell>
                  {manager && (
                    <TableHeaderCell className="w-12">
                      <span className="sr-only">{t("actions")}</span>
                    </TableHeaderCell>
                  )}
                </tr>
              </TableHead>
              <TableBody>
                {sortedMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="max-w-0">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={member.display_name} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {member.display_name}
                            {member.user_id === membership.user_id && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                ({t("you")})
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-ui-sm text-muted-foreground md:hidden">
                            {member.email}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.role === "owner"
                            ? "primary"
                            : member.role === "admin"
                              ? "primaryMinimal"
                              : "default"
                        }
                      >
                        {tRoles(member.role)}
                      </Badge>
                    </TableCell>
                    {manager && (
                      <TableCell className="py-0 text-end">
                        {member.role !== "owner" && member.user_id !== membership.user_id && (
                          <div className="flex justify-end">
                            <MemberActions
                              membershipId={member.id}
                              name={member.display_name}
                              role={member.role}
                              viewerIsOwner={membership.role === "owner"}
                            />
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {manager ? (
            <div className="space-y-3 sm:space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("inviteTitle")}</CardTitle>
                  <CardDescription>{t("inviteSubtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <InviteForm />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("pending")}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({invitations?.length ?? 0})
                    </span>
                  </CardTitle>
                </CardHeader>
                {invitations && invitations.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {invitations.map((invitation) => (
                      <li key={invitation.id} className="flex items-center gap-3 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ui font-medium">{invitation.email}</p>
                          <p className="text-ui-sm text-muted-foreground">
                            {tRoles(invitation.role)} ·{" "}
                            {t("expires", {
                              date: format.dateTime(new Date(invitation.expires_at), {
                                dateStyle: "medium",
                              }),
                            })}
                          </p>
                        </div>
                        <RevokeButton invitationId={invitation.id} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <CardContent>
                    <p className="text-ui text-muted-foreground">{t("noPending")}</p>
                  </CardContent>
                )}
              </Card>
            </div>
          ) : (
            <Alert>{t("readOnly")}</Alert>
          )}
        </div>
      </PageBody>
    </>
  );
}
