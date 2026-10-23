"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import {
  CHECKLIST_ITEM_TYPES,
  checklistTemplateSchema,
  type ChecklistItemValues,
} from "@/lib/validation";
import { saveChecklistTemplate } from "./actions";

type DraftItem = ChecklistItemValues & { key: string };

/** The saved fields of an item (without the editor's React key or the database id). */
const itemValues = (item: ChecklistItemValues): ChecklistItemValues => ({
  label: item.label,
  type: item.type,
  required: item.required,
  failCreatesDefect: item.failCreatesDefect,
});

let counter = 0;
const newKey = () => `new-${Date.now().toString(36)}-${(counter += 1)}`;

/**
 * Edits a checklist template. Saving never changes the current version: the
 * server stores the result as the next version and makes it active.
 */
export function TemplateEditor({
  deviceTypeId,
  initialName,
  initialItems,
  isSample,
  currentVersion,
}: {
  deviceTypeId: string;
  initialName: string;
  initialItems: (ChecklistItemValues & { id: string })[];
  isSample: boolean;
  currentVersion: number;
}) {
  const t = useTranslations("deviceTypes.editor");
  const tTypes = useTranslations("deviceTypes.itemTypes");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [verified, setVerified] = useState(false);
  const [items, setItems] = useState<DraftItem[]>(() =>
    initialItems.map(({ id, ...item }) => ({ ...item, key: id })),
  );
  const [errors, setErrors] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        name: initialName,
        items: initialItems.map(itemValues),
      }),
    [initialName, initialItems],
  );
  const dirty = verified || JSON.stringify({ name, items: items.map(itemValues) }) !== snapshot;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: string, patch: Partial<ChecklistItemValues>) =>
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const next = { ...item, ...patch };
        // Only a yes/no answer can fail, so only it can open a defect.
        if (next.type !== "pass_fail") next.failCreatesDefect = false;
        return next;
      }),
    );

  const move = (index: number, by: -1 | 1) =>
    setItems((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  function submit() {
    setFormError(undefined);
    const values = {
      name,
      items: items.map(itemValues),
      verified,
    };
    const parsed = checklistTemplateSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, ErrorCode> = {};
      for (const issue of parsed.error.issues) {
        const [first, index, field] = issue.path;
        if (first === "items" && typeof index === "number" && typeof field === "string") {
          next[`${items[index]?.key}.${field}`] ??= issue.message as ErrorCode;
        } else if (first === "name") {
          next.name ??= issue.message as ErrorCode;
        } else {
          setFormError(issue.message as ErrorCode);
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveChecklistTemplate(deviceTypeId, parsed.data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast(
        result.data.created
          ? t("savedVersion", { version: result.data.version })
          : t("unchanged", { version: result.data.version }),
        "success",
      );
      router.push(`/device-types/${deviceTypeId}`);
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
          <Field id="template-name" label={t("name")} error={errors.name && tErr(errors.name)}>
            <Input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
          </Field>
          {isSample && (
            <Alert variant="warning" title={t("sampleTitle")}>
              <p>{t("sampleBody")}</p>
              <label className="flex cursor-pointer items-start gap-2.5 pt-1">
                <Checkbox
                  id="template-verified"
                  checked={verified}
                  onCheckedChange={(value) => setVerified(value === true)}
                  className="mt-px"
                />
                <span>
                  {t("verified")}
                  <span className="block text-ui-sm text-muted-foreground">
                    {t("verifiedHint")}
                  </span>
                </span>
              </label>
            </Alert>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    key: newKey(),
                    label: "",
                    type: "pass_fail",
                    required: true,
                    failCreatesDefect: false,
                  },
                ])
              }
            >
              <AddIcon />
              {t("addItem")}
            </Button>
          }
        >
          <CardTitle>
            {t("items")} <span className="font-normal text-muted-foreground">({items.length})</span>
          </CardTitle>
        </CardHeader>

        <div
          aria-hidden
          className="hidden grid-cols-[36px_minmax(0,1fr)_150px_80px_130px_88px] items-center gap-2.5 bg-muted px-2.5 py-1.5 font-semibold shadow-[inset_0_-1px_0_var(--border)] lg:grid"
        >
          <span className="text-end">#</span>
          <span>{t("itemLabel")}</span>
          <span>{t("answer")}</span>
          <span className="text-center">{t("required")}</span>
          <span className="text-center">{t("defect")}</span>
          <span />
        </div>

        {items.length > 0 ? (
          <ol>
            {items.map((item, index) => {
              const labelError = errors[`${item.key}.label`];
              const defectError = errors[`${item.key}.failCreatesDefect`];
              const display = item.label.trim() || t("untitled", { number: index + 1 });
              return (
                <li
                  key={item.key}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 gap-y-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)] last:shadow-none lg:grid-cols-[36px_minmax(0,1fr)_150px_80px_130px_88px] lg:items-start lg:py-1.5"
                >
                  <span className="pt-2 text-end text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor={`item-${index}-label`} className="sr-only">
                      {t("itemLabel")}
                    </label>
                    <Input
                      id={`item-${index}-label`}
                      value={item.label}
                      maxLength={200}
                      placeholder={t("itemLabelPlaceholder")}
                      aria-invalid={labelError ? true : undefined}
                      aria-describedby={labelError ? `item-${index}-error` : undefined}
                      onChange={(event) => {
                        update(item.key, { label: event.target.value });
                        // The message refers to the old value; drop it once the field changes.
                        if (labelError) {
                          setErrors((current) => {
                            const next = { ...current };
                            delete next[`${item.key}.label`];
                            return next;
                          });
                        }
                      }}
                    />
                    {labelError && (
                      <p id={`item-${index}-error`} className="text-ui-sm text-destructive-text">
                        {tErr(labelError)}
                      </p>
                    )}
                  </div>
                  <div className="col-start-2 grid grid-cols-2 gap-2.5 sm:grid-cols-[150px_auto_auto] sm:items-center lg:contents">
                    <div>
                      <NativeSelect
                        id={`item-${index}-type`}
                        aria-label={t("answer")}
                        value={item.type}
                        onChange={(event) =>
                          update(item.key, {
                            type: event.target.value as ChecklistItemValues["type"],
                          })
                        }
                      >
                        {CHECKLIST_ITEM_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {tTypes(type)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 lg:justify-center">
                      <Checkbox
                        id={`item-${index}-required`}
                        checked={item.required}
                        aria-label={t("requiredFor", { name: display })}
                        onCheckedChange={(value) => update(item.key, { required: value === true })}
                      />
                      <span className="lg:sr-only">{t("required")}</span>
                    </label>
                    <label
                      className="col-span-2 flex min-h-9 cursor-pointer items-center gap-2 sm:col-span-1 lg:justify-center"
                      title={item.type === "pass_fail" ? undefined : t("defectHint")}
                    >
                      <Checkbox
                        id={`item-${index}-defect`}
                        checked={item.failCreatesDefect}
                        disabled={item.type !== "pass_fail"}
                        aria-label={t("defectFor", { name: display })}
                        onCheckedChange={(value) =>
                          update(item.key, { failCreatesDefect: value === true })
                        }
                      />
                      <span className="lg:sr-only">{t("defect")}</span>
                      {defectError && (
                        <span className="text-ui-sm text-destructive-text">
                          {tErr(defectError)}
                        </span>
                      )}
                    </label>
                  </div>
                  <div className="col-start-2 flex justify-end gap-0.5 lg:col-start-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      aria-label={t("moveUp", { name: display })}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      aria-label={t("moveDown", { name: display })}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      aria-label={t("remove", { name: display })}
                      onClick={() =>
                        setItems((current) => current.filter((entry) => entry.key !== item.key))
                      }
                      className="[&_svg]:text-destructive-text"
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-8 text-center text-muted-foreground">
            {tErr("templateEmpty")}
          </p>
        )}

        {formError && (
          <div className="px-5 pb-5">
            <Alert variant="error">{tErr(formError)}</Alert>
          </div>
        )}

        <CardFooter className="sm:justify-between">
          <p className="text-ui-sm text-muted-foreground">
            {t("versionNote", { version: currentVersion + 1, current: currentVersion })}
          </p>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Button asChild variant="outline">
              <Link href={`/device-types/${deviceTypeId}`}>{tCommon("cancel")}</Link>
            </Button>
            <Button type="submit" disabled={pending}>
              {t("save", { version: currentVersion + 1 })}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
