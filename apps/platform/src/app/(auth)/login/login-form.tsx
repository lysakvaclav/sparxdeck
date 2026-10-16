"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authErrorCode, type ErrorCode } from "@/lib/errors";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, magicLinkSchema } from "@/lib/validation";
import { sendMagicLink } from "../actions";

type Mode = "password" | "magic";

export function LoginForm({ next, initialError }: { next?: string; initialError?: ErrorCode }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-5">
      {mode === "password" ? (
        <PasswordForm
          next={next}
          initialError={initialError}
          defaultEmail={email}
          onEmail={setEmail}
        />
      ) : (
        <MagicLinkForm next={next} defaultEmail={email} onEmail={setEmail} />
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
      >
        {mode === "password" ? t("login.magicLinkToggle") : t("login.passwordToggle")}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
          {t("login.forgot")}
        </Link>
        <p className="text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("login.signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

type FormProps = { next?: string; defaultEmail: string; onEmail: (email: string) => void };

function PasswordForm({
  next,
  initialError,
  defaultEmail,
  onEmail,
}: FormProps & { initialError?: ErrorCode }) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode | undefined>(initialError);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    onEmail(values.email);
    startTransition(async () => {
      // Signed in from the browser on purpose: Supabase rate-limits sign-in attempts per
      // client IP, which only works if the request comes from the user, not our server.
      const { error: signInError } = await createClient().auth.signInWithPassword(values);
      if (signInError) {
        setError(authErrorCode(signInError));
        return;
      }
      router.replace(safeNextPath(next));
      router.refresh();
    });
  });

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
        error={errors.password?.message && tErr(errors.password.message as ErrorCode)}
      >
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("login.submit")}
      </Button>
    </form>
  );
}

function MagicLinkForm({ next, defaultEmail, onEmail }: FormProps) {
  const t = useTranslations("auth");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [sentTo, setSentTo] = useState<string>();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof magicLinkSchema>>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: defaultEmail },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    onEmail(values.email);
    startTransition(async () => {
      const result = await sendMagicLink(values, next);
      if (result.ok) setSentTo(values.email);
      else setError(result.error);
    });
  });

  if (sentTo) return <Alert variant="success">{t("login.magicLinkSent", { email: sentTo })}</Alert>;

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
      <Button type="submit" className="w-full" disabled={pending}>
        {t("login.magicLinkSubmit")}
      </Button>
    </form>
  );
}
