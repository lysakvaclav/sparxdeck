"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  changeEmailSchema,
  changePasswordSchema,
  displayNameSchema,
  type ChangeEmailValues,
  type ChangePasswordValues,
  type DisplayNameValues,
} from "@/lib/validation";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { changeEmail, changePassword, updateDisplayName } from "./actions";

export function DisplayNameForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("account");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const form = useForm<DisplayNameValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: defaultName },
  });
  const { error, done, pending, run } = useActionForm(form);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        run(
          () => updateDisplayName(values),
          () => form.reset(values),
        ),
      )}
    >
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {done && <Alert variant="success">{t("saved")}</Alert>}
      <Field
        id="displayName"
        label={t("displayName")}
        error={fieldError(form.formState.errors.displayName?.message)}
      >
        <Input autoComplete="name" {...form.register("displayName")} />
      </Field>
      <Button type="submit" disabled={pending || !form.formState.isDirty}>
        {t("save")}
      </Button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("account");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const [sentTo, setSentTo] = useState<string>();
  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "" },
  });
  const { error, pending, run } = useActionForm(form);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        run(
          () => changeEmail(values),
          () => {
            setSentTo(values.email);
            form.reset({ email: "" });
          },
        ),
      )}
    >
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {sentTo && <Alert variant="success">{t("emailChangeSent", { email: sentTo })}</Alert>}
      <div className="space-y-0.5">
        <p className="text-ui font-medium">{t("currentEmail")}</p>
        <p className="text-ui text-muted-foreground">{currentEmail}</p>
      </div>
      <Field
        id="newEmail"
        label={t("newEmail")}
        error={fieldError(form.formState.errors.email?.message)}
      >
        <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        {t("changeEmail")}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        run(
          () => changePassword(values),
          () => form.reset({ currentPassword: "", password: "", confirmPassword: "" }),
        ),
      )}
    >
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {done && <Alert variant="success">{t("passwordChanged")}</Alert>}
      <Field
        id="currentPassword"
        label={t("currentPassword")}
        error={fieldError(errors.currentPassword?.message)}
      >
        <Input
          type="password"
          autoComplete="current-password"
          {...form.register("currentPassword")}
        />
      </Field>
      <Field
        id="password"
        label={tAuth("newPassword")}
        hint={tAuth("passwordHint")}
        error={fieldError(errors.password?.message)}
      >
        <Input type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field
        id="confirmPassword"
        label={tAuth("confirmPassword")}
        error={fieldError(errors.confirmPassword?.message)}
      >
        <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        {t("changePassword")}
      </Button>
    </form>
  );
}
