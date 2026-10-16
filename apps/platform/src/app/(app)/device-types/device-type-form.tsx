"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { INTERVAL_MONTHS, deviceTypeSchema, type DeviceTypeInput } from "@/lib/validation";
import { updateDeviceType } from "./actions";

/** Name and default inspection interval of a device type. */
export function DeviceTypeForm({ id, defaults }: { id: string; defaults: DeviceTypeInput }) {
  const t = useTranslations("deviceTypes.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const router = useRouter();
  const toast = useToast();
  const form = useForm<DeviceTypeInput, unknown, z.output<typeof deviceTypeSchema>>({
    resolver: zodResolver(deviceTypeSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        run(
          () => updateDeviceType(id, values),
          () => {
            toast(tCommon("saved"), "success");
            router.push(`/device-types/${id}`);
          },
        ),
      )}
    >
      <div className="space-y-[15px] p-[15px]">
        <Field id="name" label={t("name")} error={fieldError(errors.name?.message)}>
          <Input autoComplete="off" {...form.register("name")} />
        </Field>
        <Field
          id="interval"
          label={t("interval")}
          hint={t("intervalHint")}
          error={fieldError(errors.interval?.message)}
          suffix={t("intervalSuffix")}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={INTERVAL_MONTHS.min}
            max={INTERVAL_MONTHS.max}
            className="w-28"
            {...form.register("interval")}
          />
        </Field>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href={`/device-types/${id}`}>{tCommon("cancel")}</Link>
        </Button>
        {/* Success navigates away; until then a second click must not save twice. */}
        <Button type="submit" disabled={pending || done}>
          {tCommon("save")}
        </Button>
      </CardFooter>
    </form>
  );
}
