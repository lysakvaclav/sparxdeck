"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { DuplicateIcon, TickIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ErrorCode } from "@/lib/errors";
import { inviteSchema, type InviteValues } from "@/lib/validation";
import { inviteMember } from "./actions";

type Outcome = { email: string; emailSent: boolean; link?: string };

export function InviteForm() {
  const t = useTranslations("team");
  const tAuth = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const tErr = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "technician" },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit((values) => {
    setError(undefined);
    setOutcome(undefined);
    startTransition(async () => {
      const result = await inviteMember(values);
      if (result.ok) {
        setOutcome(result.data);
        form.reset({ email: "", role: values.role });
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {outcome && <InviteOutcome outcome={outcome} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field
          id="invite-email"
          label={tAuth("email")}
          error={errors.email?.message && tErr(errors.email.message as ErrorCode)}
        >
          <Input type="email" autoComplete="off" inputMode="email" {...form.register("email")} />
        </Field>
        <Field id="invite-role" label={t("role")}>
          <NativeSelect {...form.register("role")}>
            <option value="technician">{tRoles("technician")}</option>
            <option value="admin">{tRoles("admin")}</option>
          </NativeSelect>
        </Field>
      </div>
      <p className="text-ui-sm text-muted-foreground">{t(`roleHint.${role}`)}</p>
      <Button type="submit" disabled={pending}>
        {t("inviteSubmit")}
      </Button>
    </form>
  );
}

function InviteOutcome({ outcome }: { outcome: Outcome }) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  if (outcome.emailSent || !outcome.link) {
    return <Alert variant="success">{t("inviteSent", { email: outcome.email })}</Alert>;
  }

  const link = outcome.link;
  return (
    <Alert variant="info">
      <p>{t("inviteCreatedNoEmail", { email: outcome.email })}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={link}
          className="font-mono text-ui-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? <TickIcon /> : <DuplicateIcon />}
          {copied ? tCommon("copied") : tCommon("copy")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("linkOnceWarning")}</p>
    </Alert>
  );
}
