import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/app/auth-heading";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getActiveMembership, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../actions";
import { AcceptForm } from "./accept-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title") };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tRoles = await getTranslations("roles");
  const tErr = await getTranslations("errors");
  const tAuth = await getTranslations("auth");

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const invitation = data?.[0];

  if (!invitation) return <InviteProblem title={t("title")} message={t("invalid")} />;
  if (invitation.accepted) return <InviteProblem title={t("title")} message={t("used")} />;
  if (invitation.expired) return <InviteProblem title={t("title")} message={t("expired")} />;

  const intro = t("body", {
    organization: invitation.organization_name,
    role: tRoles(invitation.role).toLowerCase(),
  });
  const user = await getUser();
  const next = `/invite/${encodeURIComponent(token)}`;

  if (!user) {
    const query = `next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.email)}`;
    return (
      <>
        <AuthHeading title={t("title")} subtitle={intro} />
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {t("forEmail", { email: invitation.email })} {t("signInToAccept")}
          </p>
          <div className="grid gap-3">
            <Button asChild>
              <Link href={`/signup?${query}`}>{tAuth("signup.submit")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/login?next=${encodeURIComponent(next)}`}>{tAuth("login.submit")}</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (user.email?.toLowerCase() !== invitation.email) {
    return (
      <>
        <AuthHeading title={t("title")} subtitle={intro} />
        <div className="space-y-5">
          <Alert variant="error">
            {t("wrongEmail", { current: user.email ?? "", invited: invitation.email })}
          </Alert>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              {tAuth("signOut")}
            </Button>
          </form>
        </div>
      </>
    );
  }

  if (await getActiveMembership()) {
    return <InviteProblem title={t("title")} message={tErr("alreadyMember")} />;
  }

  return (
    <>
      <AuthHeading title={t("title")} subtitle={intro} />
      <AcceptForm token={token} />
    </>
  );
}

function InviteProblem({ title, message }: { title: string; message: string }) {
  return (
    <>
      <AuthHeading title={title} />
      <Alert variant="error">{message}</Alert>
    </>
  );
}
