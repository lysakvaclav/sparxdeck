"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { BULK_MAX, DEVICE_STATUSES, formatLabel } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate, isIsoDate, nextDueDate } from "@/lib/due";
import type { DeviceTypeOption, SiteOption } from "@/lib/records";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import { bulkDevicesSchema, deviceEditSchema, deviceSchema, serialLines } from "@/lib/validation";
import { createDevice, createDevices, updateDevice } from "./actions";

/** Every field of the three forms; each mode validates (and sends) its own. */
export type DeviceFormValues = {
  siteId: string;
  locationId: string;
  deviceTypeId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  manufactureYear: string;
  customFields: Record<string, string>;
  installedOn: string;
  lastInspectionOn: string;
  endOfLifeOn: string;
  notes: string;
  status: DeviceStatus;
  count: string;
  serialNumbers: string;
};

const EMPTY: DeviceFormValues = {
  siteId: "",
  locationId: "",
  deviceTypeId: "",
  serialNumber: "",
  manufacturer: "",
  model: "",
  manufactureYear: "",
  customFields: {},
  installedOn: "",
  lastInspectionOn: "",
  endOfLifeOn: "",
  notes: "",
  status: "active",
  count: "10",
  serialNumbers: "",
};

const SCHEMAS = { create: deviceSchema, bulk: bulkDevicesSchema, edit: deviceEditSchema };

type DeviceFormProps = {
  sites: SiteOption[];
  types: DeviceTypeOption[];
  defaults: Partial<DeviceFormValues>;
  cancelHref: string;
} & ({ mode: "create" | "bulk"; deviceId?: undefined } | { mode: "edit"; deviceId: string });

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 p-5 shadow-[inset_0_-1px_0_var(--border)]">
      <div>
        <h2 className="text-ui font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-ui-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * Adds one device, several at once (shared details, optional serial numbers) or
 * edits one. The label number, QR token and next due date come from the database.
 */
export function DeviceForm(props: DeviceFormProps) {
  const { mode, sites, types } = props;
  const t = useTranslations("devices.form");
  const tStatus = useTranslations("devices.status");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const format = useFormatter();
  const fieldError = useFieldError();
  const router = useRouter();
  const toast = useToast();
  const form = useForm<DeviceFormValues>({
    // The resolver checks this mode's fields; the server parses the same schema again.
    resolver: zodResolver(SCHEMAS[mode]) as unknown as Resolver<DeviceFormValues>,
    defaultValues: { ...EMPTY, ...props.defaults },
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;
  const [siteId, deviceTypeId, lastInspectionOn, count, serialNumbers] = useWatch({
    control: form.control,
    name: ["siteId", "deviceTypeId", "lastInspectionOn", "count", "serialNumbers"],
  });

  const site = sites.find((option) => option.id === siteId);
  const type = types.find((option) => option.id === deviceTypeId);
  const fields = type?.customFields ?? [];
  const nextDue =
    type && isIsoDate(lastInspectionOn) ? nextDueDate(lastInspectionOn, type.intervalMonths) : null;
  const serialCount = serialLines(serialNumbers).length;
  const bulkCount = Number(count);
  // One group per customer in the building picker, in the order of the list.
  const customers = [...new Map(sites.map((option) => [option.customerId, option.customerName]))];

  function submit() {
    const values = form.getValues();
    if (props.mode === "edit") {
      const { deviceId } = props;
      run(
        () => updateDevice(deviceId, values),
        () => {
          toast(tCommon("saved"), "success");
          router.push(`/devices/${deviceId}`);
        },
      );
      return;
    }
    if (mode === "bulk") {
      let message = "";
      run(
        async () => {
          const result = await createDevices(values);
          if (result.ok)
            message = t("bulkCreated", {
              count: result.data.count,
              from: formatLabel(result.data.first),
              to: formatLabel(result.data.last),
            });
          return result;
        },
        () => {
          toast(message, "success");
          router.push(`/sites/${values.siteId}`);
        },
      );
      return;
    }
    let created: { id: string; labelNumber: number } | undefined;
    run(
      async () => {
        const result = await createDevice(values);
        if (result.ok) created = result.data;
        return result;
      },
      () => {
        if (!created) return;
        toast(t("created", { label: formatLabel(created.labelNumber) }), "success");
        router.push(`/devices/${created.id}`);
      },
    );
  }

  const twoColumns = "grid grid-cols-1 gap-4 sm:grid-cols-2";

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)}>
      <Section title={t("placement")}>
        <Field id="siteId" label={t("site")} error={fieldError(errors.siteId?.message)}>
          <NativeSelect
            disabled={mode === "edit"}
            {...form.register("siteId", {
              // Locations belong to a building: a new building starts without one.
              onChange: () => form.setValue("locationId", ""),
            })}
          >
            {!siteId && <option value="">{t("sitePlaceholder")}</option>}
            {customers.map(([customerId, customerName]) => (
              <optgroup key={customerId} label={customerName}>
                {sites
                  .filter((option) => option.customerId === customerId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="locationId"
          label={t("location")}
          hint={site && site.locations.length === 0 ? t("noLocationsHint") : undefined}
          error={fieldError(errors.locationId?.message)}
        >
          <NativeSelect
            disabled={!site || site.locations.length === 0}
            {...form.register("locationId")}
          >
            <option value="">{t("noLocation")}</option>
            {site?.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Section>

      {mode === "bulk" && (
        <Section title={t("count")} description={t("countHint")}>
          <Field id="count" label={t("count")} error={fieldError(errors.count?.message)}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={BULK_MAX}
              className="w-28"
              {...form.register("count")}
            />
          </Field>
          <Field
            id="serialNumbers"
            label={t("serials")}
            hint={
              serialCount > 0
                ? `${t("serialsHint")} (${t("serialsCount", { count: serialCount })})`
                : t("serialsHint")
            }
            error={fieldError(errors.serialNumbers?.message)}
          >
            <Textarea
              rows={6}
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-ui-sm"
              {...form.register("serialNumbers", {
                // Pasting a list sets the count to match it.
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const lines = serialLines(event.target.value).length;
                  if (lines > 0 && lines <= BULK_MAX)
                    form.setValue("count", String(lines), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                },
              })}
            />
          </Field>
        </Section>
      )}

      <Section
        title={mode === "bulk" ? t("shared") : t("details")}
        description={
          mode === "bulk" ? t("sharedHint") : mode === "create" ? t("labelAuto") : undefined
        }
      >
        <Field id="deviceTypeId" label={t("type")} error={fieldError(errors.deviceTypeId?.message)}>
          <NativeSelect {...form.register("deviceTypeId")}>
            {!deviceTypeId && <option value="">—</option>}
            {types.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {mode !== "bulk" && (
          <Field
            id="serialNumber"
            label={t("serial")}
            error={fieldError(errors.serialNumber?.message)}
          >
            <Input autoComplete="off" spellCheck={false} {...form.register("serialNumber")} />
          </Field>
        )}
        <div className={twoColumns}>
          <Field
            id="manufacturer"
            label={t("manufacturer")}
            error={fieldError(errors.manufacturer?.message)}
          >
            <Input autoComplete="off" {...form.register("manufacturer")} />
          </Field>
          <Field id="model" label={t("model")} error={fieldError(errors.model?.message)}>
            <Input autoComplete="off" {...form.register("model")} />
          </Field>
        </div>
        {fields.length > 0 && (
          <div className={twoColumns}>
            {fields.map((field) => (
              <Field
                key={field.key}
                id={`field-${field.key}`}
                label={field.label}
                error={fieldError(errors.customFields?.[field.key]?.message)}
              >
                <Input autoComplete="off" {...form.register(`customFields.${field.key}`)} />
              </Field>
            ))}
          </div>
        )}
        <div className={twoColumns}>
          <Field
            id="manufactureYear"
            label={t("manufactureYear")}
            error={fieldError(errors.manufactureYear?.message)}
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="2024"
              className="w-28"
              {...form.register("manufactureYear")}
            />
          </Field>
          <Field
            id="installedOn"
            label={t("installedOn")}
            error={fieldError(errors.installedOn?.message)}
          >
            <Input type="date" className="w-44" {...form.register("installedOn")} />
          </Field>
        </div>
        <Field
          id="endOfLifeOn"
          label={t("endOfLifeOn")}
          hint={t("endOfLifeHint")}
          error={fieldError(errors.endOfLifeOn?.message)}
        >
          <Input type="date" className="w-44" {...form.register("endOfLifeOn")} />
        </Field>
      </Section>

      <Section title={t("inspection")}>
        <Field
          id="lastInspectionOn"
          label={t("lastInspectionOn")}
          hint={t("lastInspectionHint")}
          error={fieldError(errors.lastInspectionOn?.message)}
          suffix={
            nextDue && (
              <span className="text-foreground" aria-live="polite">
                {t("nextDuePreview", {
                  date: format.dateTime(calendarDate(nextDue), CALENDAR_FORMAT),
                })}
              </span>
            )
          }
        >
          <Input type="date" className="w-44" {...form.register("lastInspectionOn")} />
        </Field>
        {mode === "edit" && (
          <Field
            id="status"
            label={t("status")}
            hint={t("statusHint")}
            error={fieldError(errors.status?.message)}
          >
            <NativeSelect className="sm:max-w-xs" {...form.register("status")}>
              {DEVICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field id="notes" label={t("notes")} error={fieldError(errors.notes?.message)}>
          <Textarea rows={3} {...form.register("notes")} />
        </Field>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </Section>

      <CardFooter className="shadow-none">
        <Button asChild variant="outline">
          <Link href={props.cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {/* Success navigates away; until then a second click must not save twice. */}
        <Button type="submit" disabled={pending || done}>
          {mode === "edit"
            ? tCommon("save")
            : mode === "bulk" &&
                Number.isInteger(bulkCount) &&
                bulkCount > 0 &&
                bulkCount <= BULK_MAX
              ? t("bulkCreate", { count: bulkCount })
              : t("create")}
        </Button>
      </CardFooter>
    </form>
  );
}
