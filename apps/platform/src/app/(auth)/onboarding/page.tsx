import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/app/auth-heading";
import { getActiveMembership, requireUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  await requireUser();
  if (await getActiveMembership()) redirect("/");
  const t = await getTranslations("onboarding");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <OnboardingForm />
    </>
  );
}
