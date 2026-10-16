"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErrorCode } from "@/lib/errors";
import { acceptInviteSchema } from "@/lib/validation";
import { acceptInvitation } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof acceptInviteSchema>>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, displayName: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    startTransition(async () => {
      const result = await acceptInvitation(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      <input type="hidden" {...form.register("token")} />
      <Field
        id="displayName"
        label={t("displayName")}
        error={errors.displayName?.message && tErr(errors.displayName.message as ErrorCode)}
      >
        <Input autoComplete="name" autoFocus {...form.register("displayName")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {t("accept")}
      </Button>
    </form>
  );
}
