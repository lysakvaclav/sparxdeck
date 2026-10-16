import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PersonIcon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser, requireMembership } from "@/lib/auth";
import { DisplayNameForm, EmailForm, PasswordForm } from "./account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const { membership } = await requireMembership();
  const user = await getUser();
  const t = await getTranslations("account");

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
        </div>
      </PageBody>
    </>
  );
}
