import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PersonIcon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PointForm } from "@/components/app/point-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser, requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setMyHome } from "../routes/actions";
import { DisplayNameForm, EmailForm, PasswordForm } from "./account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const { membership } = await requireMembership();
  const user = await getUser();
  const t = await getTranslations("account");
  const supabase = await createClient();
  const { data: home } = await supabase
    .from("member_homes")
    .select("latitude, longitude")
    .eq("organization_id", membership.organization_id)
    .eq("user_id", membership.user_id)
    .maybeSingle();

  return (
    <>
      <PageHeader icon={PersonIcon} iconClassName="text-muted-foreground" title={t("title")} />
      <PageBody width="narrow">
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("nameTitle")}</CardTitle>
              <CardDescription>{t("nameDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <DisplayNameForm defaultName={membership.display_name} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("emailTitle")}</CardTitle>
              <CardDescription>{t("emailDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailForm currentEmail={user?.email ?? membership.email} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("passwordTitle")}</CardTitle>
              <CardDescription>{t("passwordDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("home.title")}</CardTitle>
              <CardDescription>{t("home.hint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PointForm id="home-point" label={t("home.label")} initial={home} save={setMyHome} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
