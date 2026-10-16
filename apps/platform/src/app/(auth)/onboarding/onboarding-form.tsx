"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/errors";
import { onboardingSchema, type OnboardingValues } from "@/lib/validation";
import { createOrganization } from "./actions";

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { organizationName: "", displayName: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      <Field
        id="organizationName"
        label={t("organizationName")}
        error={
          errors.organizationName?.message && tErr(errors.organizationName.message as ErrorCode)
        }
      >
        <Input
          autoComplete="organization"
          placeholder={t("organizationPlaceholder")}
          autoFocus
          {...form.register("organizationName")}
        />
      </Field>
      <Field
        id="displayName"
        label={t("displayName")}
        error={errors.displayName?.message && tErr(errors.displayName.message as ErrorCode)}
      >
        <Input
          autoComplete="name"
          placeholder={t("displayNamePlaceholder")}
          {...form.register("displayName")}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
