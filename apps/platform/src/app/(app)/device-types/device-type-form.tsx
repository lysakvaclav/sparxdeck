"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import { FIELD_LABEL_MAX, MAX_DEVICE_TYPE_FIELDS, slugifyCode } from "@/lib/devices";
import { INTERVAL_MONTHS, deviceTypeSchema } from "@/lib/validation";
import { createDeviceType, updateDeviceType } from "./actions";

type DraftField = {
  /** React list key, stable for the row's lifetime (not the stored attribute key). */
  rowKey: string;
  /** The attribute key: frozen once the field exists in the database. */
  fieldKey: string;
  label: string;
  /** New in this session: its key still follows the label as it's typed. */
  isNew: boolean;
};

let counter = 0;
const newRowKey = () => `new-${Date.now().toString(36)}-${(counter += 1)}`;

/** A free attribute key among the row's siblings ("velikost", "velikost_2", ...). */
function freeKey(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`.slice(0, 40);
    if (!taken.includes(candidate)) return candidate;
  }
}

/**
 * Name, inspection interval and the type's own fields (devices.attributes). A
 * new field's key is derived from its label and frozen once saved, so renaming
 * a label later never orphans values already stored under the old key.
 */
export function DeviceTypeForm(
  props: { defaults: { name: string; interval: number } } & (
    | { mode: "create" }
    | { mode: "edit"; id: string; fields: { key: string; label: string }[] }
  ),
) {
  const t = useTranslations("deviceTypes.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(props.defaults.name);
  const [interval, setInterval] = useState(String(props.defaults.interval));
  const [fields, setFields] = useState<DraftField[]>(() =>
    props.mode === "edit"
      ? props.fields.map((field) => ({
          rowKey: field.key,
          fieldKey: field.key,
          label: field.label,
          isNew: false,
        }))
      : [],
  );
  const [errors, setErrors] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();

  function addField() {
    setFields((current) => [
      ...current,
      { rowKey: newRowKey(), fieldKey: "", label: "", isNew: true },
    ]);
  }

  function editLabel(rowKey: string, label: string) {
    setFields((current) => {
      const others = current.filter((field) => field.rowKey !== rowKey).map((f) => f.fieldKey);
      return current.map((field) =>
        field.rowKey === rowKey
          ? { ...field, label, fieldKey: field.isNew ? freeKey(slugifyCode(label), others) : field.fieldKey }
          : field,
      );
    });
  }

  function removeField(rowKey: string) {
    setFields((current) => current.filter((field) => field.rowKey !== rowKey));
  }

  function submit() {
    setFormError(undefined);
    const values = {
      name,
      interval,
      fields: fields
        .filter((field) => field.label.trim())
        .map((field) => ({ key: field.fieldKey, label: field.label })),
    };
    const parsed = deviceTypeSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, ErrorCode> = {};
      for (const issue of parsed.error.issues) {
        const [first, index] = issue.path;
        if (first === "fields" && typeof index === "number") {
          const row = fields.filter((f) => f.label.trim())[index];
          if (row) next[row.rowKey] ??= issue.message as ErrorCode;
        } else if (first === "name" || first === "interval") {
          next[first] ??= issue.message as ErrorCode;
        } else {
          setFormError(issue.message as ErrorCode);
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createDeviceType(parsed.data);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        toast(tCommon("saved"), "success");
        router.push(`/device-types/${result.data.id}/template`);
        return;
      }
      const result = await updateDeviceType(props.id, parsed.data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast(tCommon("saved"), "success");
      router.push(`/device-types/${props.id}`);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-3 sm:space-y-5"
    >
      <Card>
        <div className="space-y-4 p-5">
          <Field id="name" label={t("name")} error={errors.name && tErr(errors.name)}>
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field
            id="interval"
            label={t("interval")}
            hint={t("intervalHint")}
            error={errors.interval && tErr(errors.interval)}
            suffix={t("intervalSuffix")}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={INTERVAL_MONTHS.min}
              max={INTERVAL_MONTHS.max}
              className="w-28"
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          actions={
            fields.length < MAX_DEVICE_TYPE_FIELDS && (
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <AddIcon />
                {t("addField")}
              </Button>
            )
          }
        >
          <CardTitle>{t("fields")}</CardTitle>
          <p className="text-ui-sm text-muted-foreground">{t("fieldsHint")}</p>
        </CardHeader>
        {fields.length > 0 && (
          <ul>
            {fields.map((field) => (
              <li
                key={field.rowKey}
                className="flex items-start gap-2 px-5 py-2.5 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor={`field-${field.rowKey}`} className="sr-only">
                    {t("fieldLabel")}
                  </label>
                  <Input
                    id={`field-${field.rowKey}`}
                    placeholder={t("fieldLabelPlaceholder")}
                    maxLength={FIELD_LABEL_MAX}
                    value={field.label}
                    aria-invalid={errors[field.rowKey] ? true : undefined}
                    aria-describedby={errors[field.rowKey] ? `field-${field.rowKey}-error` : undefined}
                    onChange={(event) => editLabel(field.rowKey, event.target.value)}
                  />
                  {errors[field.rowKey] && (
                    <p
                      id={`field-${field.rowKey}-error`}
                      className="text-ui-sm text-destructive-text"
                    >
                      {tErr(errors[field.rowKey]!)}
                    </p>
                  )}
                  {field.fieldKey && (
                    <p className="font-mono text-ui-sm text-muted-foreground">{field.fieldKey}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeField", { name: field.label || field.fieldKey })}
                  onClick={() => removeField(field.rowKey)}
                  className="mt-0.5"
                >
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {formError && (
          <Alert variant="error" className="m-5 mt-0">
            {tErr(formError)}
          </Alert>
        )}
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={props.mode === "create" ? "/device-types" : `/device-types/${props.id}`}>
              {tCommon("cancel")}
            </Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {tCommon("save")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
