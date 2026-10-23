"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MediaIcon, TrashIcon } from "@/components/icons";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import type { ErrorCode } from "@/lib/errors";
import {
  companyDetailsSchema,
  deadlineSettingsSchema,
  digestSettingsSchema,
  protocolSettingsSchema,
  regionalSettingsSchema,
  type CompanyDetailsInput,
  type DeadlineSettingsInput,
  type DigestSettingsInput,
  type ProtocolSettingsInput,
  type RegionalSettingsValues,
} from "@/lib/validation";
import {
  removeLogo,
  saveCompanyDetails,
  saveDeadlineSettings,
  saveDigestSettings,
  saveProtocolSettings,
  saveRegionalSettings,
  uploadLogo,
} from "./actions";

type Editable = { disabled: boolean };
type TimezoneOption = { value: string; label: string };

/** Shared footer of each settings form: status messages and the save button. */
function FormFooter({
  error,
  done,
  pending,
  disabled,
}: {
  error?: ErrorCode;
  done: boolean;
  pending: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("settings");
  const tErr = useTranslations("errors");
  if (disabled) return null;
  return (
    <div className="-mx-[15px] -mb-[15px] space-y-2.5 px-[15px] py-2.5 shadow-[inset_0_1px_0_var(--border)]">
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {done && <Alert variant="success">{t("saved")}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

export function CompanyForm({ defaults, disabled }: { defaults: CompanyDetailsInput } & Editable) {
  const t = useTranslations("settings.company");
  const fieldError = useFieldError();
  const form = useForm<CompanyDetailsInput, unknown, z.output<typeof companyDetailsSchema>>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() => run(() => saveCompanyDetails(form.getValues())))}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            id="name"
            label={t("name")}
            hint={t("nameHint")}
            error={fieldError(errors.name?.message)}
          >
            <Input autoComplete="organization" {...form.register("name")} />
          </Field>
          <Field
            id="legalName"
            label={t("legalName")}
            hint={t("legalNameHint")}
            error={fieldError(errors.legalName?.message)}
          >
            <Input {...form.register("legalName")} />
          </Field>
          <Field
            id="companyId"
            label={t("companyId")}
            error={fieldError(errors.companyId?.message)}
          >
            <Input inputMode="numeric" autoComplete="off" {...form.register("companyId")} />
          </Field>
          <Field id="vatId" label={t("vatId")} error={fieldError(errors.vatId?.message)}>
            <Input autoComplete="off" className="uppercase" {...form.register("vatId")} />
          </Field>
          <Field
            id="address"
            label={t("address")}
            error={fieldError(errors.address?.message)}
            className="md:col-span-2"
          >
            <Textarea
              rows={3}
              autoComplete="street-address"
              placeholder={t("addressPlaceholder")}
              {...form.register("address")}
            />
          </Field>
          <Field id="email" label={t("email")} error={fieldError(errors.email?.message)}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </Field>
          <Field id="phone" label={t("phone")} error={fieldError(errors.phone?.message)}>
            <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
          </Field>
        </div>
        <FormFooter error={error} done={done} pending={pending} disabled={disabled} />
      </fieldset>
    </form>
  );
}

export function LogoForm({
  logoUrl,
  organizationName,
  disabled,
}: { logoUrl: string | null; organizationName: string } & Editable) {
  const t = useTranslations("settings.logo");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<ErrorCode>();
  const [message, setMessage] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setMessage(undefined);
    // Quick checks for instant feedback; the server checks the actual bytes again.
    if (file.size > 2 * 1024 * 1024) return setError("fileTooLarge");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return setError("fileTypeInvalid");

    const data = new FormData();
    data.set("logo", file);
    startTransition(async () => {
      const result = await uploadLogo(data);
      if (inputRef.current) inputRef.current.value = "";
      if (!result.ok) return setError(result.error);
      setMessage(t("uploaded"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-md bg-white p-3 shadow-[inset_0_0_0_1px_var(--border)] sm:w-52">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimizable
            <img
              src={logoUrl}
              alt={t("alt", { name: organizationName })}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-ui text-subtle">{t("none")}</span>
          )}
        </div>
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              id="logo-input"
              tabIndex={-1}
              aria-label={logoUrl ? t("replace") : t("upload")}
              onChange={(event) => onFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <MediaIcon />
              {logoUrl ? t("replace") : t("upload")}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                <TrashIcon />
                {t("remove")}
              </Button>
            )}
          </div>
        )}
      </div>
      {error && <Alert variant="error">{tErr(error)}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmBody")}
        confirmLabel={t("remove")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await removeLogo();
            setConfirming(false);
            if (!result.ok) return setError(result.error);
            setMessage(t("removed"));
            router.refresh();
          })
        }
      />
    </div>
  );
}

export function ProtocolForm({
  defaults,
  disabled,
}: { defaults: ProtocolSettingsInput } & Editable) {
  const t = useTranslations("settings.protocol");
  const fieldError = useFieldError();
  const form = useForm<ProtocolSettingsInput, unknown, z.output<typeof protocolSettingsSchema>>({
    resolver: zodResolver(protocolSettingsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const footer = useWatch({ control: form.control, name: "footer" }) ?? "";

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() => run(() => saveProtocolSettings(form.getValues())))}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <Field
          id="footer"
          label={t("footer")}
          hint={`${t("footerHint")} ${footer.length} / 1000`}
          error={fieldError(form.formState.errors.footer?.message)}
        >
          <Textarea
            rows={4}
            maxLength={1000}
            placeholder={t("footerPlaceholder")}
            {...form.register("footer")}
          />
        </Field>
        <Field
          id="numberFormat"
          label={t("numberFormat")}
          hint={t("numberFormatHint")}
          error={fieldError(form.formState.errors.numberFormat?.message)}
        >
          <NativeSelect {...form.register("numberFormat")}>
            <option value="year_number">2026-0007</option>
            <option value="year_slash_number">2026/0007</option>
            <option value="number_year">0007/2026</option>
          </NativeSelect>
        </Field>
        <FormFooter error={error} done={done} pending={pending} disabled={disabled} />
      </fieldset>
    </form>
  );
}

export function RegionalForm({
  defaults,
  timezones,
  disabled,
}: {
  defaults: RegionalSettingsValues;
  timezones: { common: TimezoneOption[]; all: TimezoneOption[] };
} & Editable) {
  const t = useTranslations("settings.regional");
  const fieldError = useFieldError();
  const form = useForm<RegionalSettingsValues>({
    resolver: zodResolver(regionalSettingsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => run(() => saveRegionalSettings(values)))}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            id="defaultLocale"
            label={t("defaultLocale")}
            error={fieldError(errors.defaultLocale?.message)}
          >
            <NativeSelect {...form.register("defaultLocale")}>
              <option value="cs">Čeština</option>
              <option value="en">English</option>
            </NativeSelect>
          </Field>
          <Field id="timezone" label={t("timezone")} error={fieldError(errors.timezone?.message)}>
            <NativeSelect {...form.register("timezone")}>
              <optgroup label="★">
                {timezones.common.map((zone) => (
                  <option key={`common-${zone.value}`} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="A–Z">
                {timezones.all.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
            </NativeSelect>
          </Field>
        </div>
        <FormFooter error={error} done={done} pending={pending} disabled={disabled} />
      </fieldset>
    </form>
  );
}

export function DeadlinesForm({
  defaults,
  disabled,
}: { defaults: DeadlineSettingsInput } & Editable) {
  const t = useTranslations("settings.deadlines");
  const fieldError = useFieldError();
  const form = useForm<DeadlineSettingsInput, unknown, z.output<typeof deadlineSettingsSchema>>({
    resolver: zodResolver(deadlineSettingsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => run(() => saveDeadlineSettings(values)))}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <Field
          id="dueSoonDays"
          label={t("dueSoonDays")}
          hint={t("dueSoonDaysHint")}
          error={fieldError(form.formState.errors.dueSoonDays?.message)}
          suffix={t("dueSoonDaysSuffix")}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            className="w-28"
            {...form.register("dueSoonDays")}
          />
        </Field>
        <FormFooter error={error} done={done} pending={pending} disabled={disabled} />
      </fieldset>
    </form>
  );
}

export function DigestForm({ defaults, disabled }: { defaults: DigestSettingsInput } & Editable) {
  const t = useTranslations("settings.digest");
  const form = useForm<DigestSettingsInput, unknown, z.output<typeof digestSettingsSchema>>({
    resolver: zodResolver(digestSettingsSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => run(() => saveDigestSettings(values)))}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <label className="flex min-h-[30px] cursor-pointer items-center gap-2.5 pointer-coarse:min-h-11">
          <Controller
            control={form.control}
            name="weeklyDigest"
            render={({ field }) => (
              <Checkbox
                id="weeklyDigest"
                checked={field.value}
                disabled={disabled}
                onCheckedChange={(value) => field.onChange(value === true)}
              />
            )}
          />
          <span>{t("enabled")}</span>
        </label>
        <FormFooter error={error} done={done} pending={pending} disabled={disabled} />
      </fieldset>
    </form>
  );
}
