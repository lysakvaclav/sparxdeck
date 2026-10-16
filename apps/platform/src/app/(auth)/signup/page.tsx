import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/app/auth-heading";
import { safeNextPath } from "@/lib/safe-next";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  const t = await getTranslations("auth.signup");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <SignupForm next={next ? safeNextPath(next) : undefined} defaultEmail={email} />
    </>
  );
}
