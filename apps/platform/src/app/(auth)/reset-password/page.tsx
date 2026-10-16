"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { AuthHeading } from "@/components/app/auth-heading";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/errors";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";
import { updatePassword } from "../actions";

// Reached from the password-reset e-mail; the callback has already signed the user in.
export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result && !result.ok) {
        if (result.fieldErrors?.password) {
          form.setError("password", { message: result.fieldErrors.password });
        } else {
          setError(result.error);
        }
      }
    });
  });

  return (
    <>
      <AuthHeading title={t("reset.title")} subtitle={t("reset.subtitle")} />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Alert variant="error">{tErr(error)}</Alert>}
        <Field
          id="password"
          label={t("newPassword")}
          hint={t("passwordHint")}
          error={errors.password?.message && tErr(errors.password.message as ErrorCode)}
        >
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            {...form.register("password")}
          />
        </Field>
        <Field
          id="confirmPassword"
          label={t("confirmPassword")}
          error={
            errors.confirmPassword?.message && tErr(errors.confirmPassword.message as ErrorCode)
          }
        >
          <Input
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {t("reset.submit")}
        </Button>
      </form>
    </>
  );
}
