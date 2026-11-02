"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { AddIcon, CopyIcon, TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import type { ErrorCode } from "@/lib/errors";
import {
  mcpSettingsSchema,
  personalTokenSchema,
  type McpSettingsInput,
  type PersonalTokenInput,
} from "@/lib/validation";
import { createPersonalToken, revokeMcpToken, saveMcpSettings } from "./actions";

/** The owner's switches; everyone else sees them read-only. */
export function McpSettingsForm({ defaults, disabled }: { defaults: McpSettingsInput; disabled: boolean }) {
  const t = useTranslations("mcp.page.status");
  const tErr = useTranslations("errors");
  const form = useForm<McpSettingsInput, unknown, z.output<typeof mcpSettingsSchema>>({
    resolver: zodResolver(mcpSettingsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const enabled = useWatch({ control: form.control, name: "enabled" });

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => run(() => saveMcpSettings(values)))}>
      <fieldset disabled={disabled} className="space-y-3">
        {(["enabled", "write"] as const).map((name) => (
          <label
            key={name}
            className="flex min-h-[30px] cursor-pointer items-start gap-2.5 pointer-coarse:min-h-11"
          >
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Checkbox
                  id={`mcp-${name}`}
                  className="mt-0.5"
                  checked={name === "write" ? field.value && enabled : field.value}
                  disabled={disabled || (name === "write" && !enabled)}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              )}
            />
            <span>{t(name)}</span>
          </label>
        ))}
        {error && <Alert variant="error">{tErr(error)}</Alert>}
        {done && <Alert variant="success">{t("saved")}</Alert>}
        {!disabled && (
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        )}
      </fieldset>
    </form>
  );
}

/** A value to paste somewhere else, with a copy button. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const t = useTranslations("mcp.page.connect");
  const toast = useToast();
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast(t("copied"));
        }}
      >
        <CopyIcon />
        {t("copy")}
      </Button>
    </div>
  );
}

/** A personal token: created here, shown once. */
export function PersonalTokenForm({ writeAllowed }: { writeAllowed: boolean }) {
  const t = useTranslations("mcp.page.token");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const form = useForm<PersonalTokenInput, unknown, z.output<typeof personalTokenSchema>>({
    resolver: zodResolver(personalTokenSchema),
    defaultValues: { name: "", days: "90", write: false },
  });
  const fieldError = useFieldError();
  const nameError = fieldError(form.formState.errors.name?.message);

  if (token)
    return (
      <div className="space-y-3">
        <Alert variant="success">
          <span className="font-medium">{t("createdTitle")}</span> {t("createdBody")}
        </Alert>
        <CopyField value={token} label={t("createdTitle")} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setToken(null);
            form.reset();
            router.refresh();
          }}
        >
          {t("done")}
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(undefined);
          const result = await createPersonalToken(values);
          if (result.ok) setToken(result.data.token);
          else setError(result.error);
        }),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field id="token-name" label={t("name")} error={nameError}>
          <Input placeholder={t("namePlaceholder")} maxLength={100} {...form.register("name")} />
        </Field>
        <Field id="token-days" label={t("days")}>
          <NativeSelect {...form.register("days")}>
            <option value="30">{t("days30")}</option>
            <option value="90">{t("days90")}</option>
            <option value="365">{t("days365")}</option>
          </NativeSelect>
        </Field>
      </div>
      {writeAllowed ? (
        <label className="flex min-h-[30px] cursor-pointer items-center gap-2.5 pointer-coarse:min-h-11">
          <Controller
            control={form.control}
            name="write"
            render={({ field }) => (
              <Checkbox id="token-write" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            )}
          />
          <span>{t("write")}</span>
        </label>
      ) : (
        <p className="text-ui text-muted-foreground">{t("writeUnavailable")}</p>
      )}
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      <Button type="submit" disabled={pending}>
        <AddIcon />
        {t("create")}
      </Button>
    </form>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("mcp.page.connections");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TrashIcon />
        {t("revoke")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("revokeTitle")}
        description={t("revokeBody", { name })}
        confirmLabel={t("revoke")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await revokeMcpToken(id);
            setOpen(false);
            if (result.ok) {
              toast(t("revoked"));
              router.refresh();
            }
          })
        }
      />
    </>
  );
}
