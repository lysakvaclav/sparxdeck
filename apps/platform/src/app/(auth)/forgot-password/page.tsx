"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { AuthHeading } from "@/components/app/auth-heading";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/errors";
import { forgotPasswordSchema } from "@/lib/validation";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [sentTo, setSentTo] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.ok) setSentTo(values.email);
      else setError(result.error);
    });
  });

  return (
    <>
      <AuthHeading title={t("forgot.title")} subtitle={t("forgot.subtitle")} />
      {sentTo ? (
        <Alert variant="success">{t("forgot.sent", { email: sentTo })}</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <Alert variant="error">{tErr(error)}</Alert>}
          <Field
            id="email"
            label={t("email")}
            error={errors.email?.message && tErr(errors.email.message as ErrorCode)}
          >
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              {...form.register("email")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {t("forgot.submit")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          {t("forgot.backToLogin")}
        </Link>
      </p>
    </>
  );
}
