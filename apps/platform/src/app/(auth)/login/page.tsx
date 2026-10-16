import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/app/auth-heading";
import type { ErrorCode } from "@/lib/errors";
import { safeNextPath } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

const LINK_ERRORS: readonly ErrorCode[] = ["linkInvalid"];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth.login");
  const initialError = LINK_ERRORS.find((code) => code === error);

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <LoginForm next={next ? safeNextPath(next) : undefined} initialError={initialError} />
    </>
  );
}
