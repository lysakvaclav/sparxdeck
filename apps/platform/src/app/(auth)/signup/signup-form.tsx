"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/errors";
import { signupSchema, type SignupValues } from "@/lib/validation";
import { signUp } from "../actions";

export function SignupForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [sentTo, setSentTo] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: defaultEmail ?? "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await signUp(values, next);
      if (result?.ok) setSentTo(values.email);
      else if (result?.fieldErrors?.password)
        form.setError("password", { message: result.fieldErrors.password });
      else if (result) setError(result.error);
    });
  });

  if (sentTo) {
    return (
      <div className="space-y-4">
        <MailCheck aria-hidden className="size-8 text-foreground" strokeWidth={1.5} />
        <h2 className="text-2xl">{t("signup.checkEmailTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("signup.checkEmail", { email: sentTo })}</p>
      </div>
    );
  }

  return (
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
      <Field
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
        error={errors.password?.message && tErr(errors.password.message as ErrorCode)}
      >
        <Input type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("signup.submit")}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t("signup.hasAccount")}{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signup.loginLink")}
        </Link>
      </p>
    </form>
  );
}
