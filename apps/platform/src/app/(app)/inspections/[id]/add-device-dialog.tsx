"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/errors";
import { formatLabel } from "@/lib/devices";
import {
  inspectionDeviceSchema,
  type InspectionDeviceInput,
  type InspectionDeviceValues,
} from "@/lib/validation";
import type { FieldDeviceType, FieldLocation } from "@/lib/field";
import { addInspectionDevice } from "../actions";

export type { FieldDeviceType, FieldLocation } from "@/lib/field";

/**
 * A device the technician finds in the building but not on the list: added to
 * the building (with the next label number) and opened for its check at once.
 * It needs a connection (the database gives the number).
 */
export function AddDeviceButton({
  inspectionId,
  types,
  locations,
  offline,
  onAdded,
}: {
  inspectionId: string;
  types: FieldDeviceType[];
  locations: FieldLocation[];
  offline: boolean;
  onAdded: (deviceId: string) => void;
}) {
  const t = useTranslations("inspections.addDevice");
  const tForm = useTranslations("devices.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const fieldError = useFieldError();
  const [open, setOpen] = useState(false);
  const defaultType =
    types.find((type) => type.code === "fire_extinguisher")?.id ?? types[0]?.id ?? "";
  const empty: InspectionDeviceInput = {
    deviceTypeId: defaultType,
    locationId: "",
    serialNumber: "",
    manufacturer: "",
    model: "",
    manufactureYear: "",
    customFields: {},
    notes: "",
  };
  const form = useForm<InspectionDeviceInput, unknown, InspectionDeviceValues>({
    resolver: zodResolver(inspectionDeviceSchema),
    defaultValues: empty,
  });
  const { error, pending, run } = useActionForm(form);
  const { errors } = form.formState;
  const typeId = useWatch({ control: form.control, name: "deviceTypeId" });
  const extra = types.find((type) => type.id === typeId)?.customFields ?? [];

  function submit() {
    let created: { id: string; labelNumber: number } | null = null;
    run(
      async (): Promise<ActionResult> => {
        const result = await addInspectionDevice(inspectionId, form.getValues());
        if (!result.ok) return result;
        created = result.data;
        return { ok: true };
      },
      () => {
        setOpen(false);
        form.reset(empty);
        const device = created as { id: string; labelNumber: number } | null;
        if (!device) return;
        toast(t("added", { label: formatLabel(device.labelNumber) }), "success");
        onAdded(device.id);
      },
    );
  }

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!types.length || offline}
        title={offline ? t("offline") : undefined}
      >
        <AddIcon />
        {t("action")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={t("title")}
        icon={AddIcon}
        closeLabel={tCommon("close")}
      >
        <form noValidate className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          <p className="text-ui text-muted-foreground">{t("hint")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="add-type"
              label={tForm("type")}
              error={fieldError(errors.deviceTypeId?.message)}
            >
              <NativeSelect {...form.register("deviceTypeId")}>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              id="add-location"
              label={tForm("location")}
              error={fieldError(errors.locationId?.message)}
            >
              <NativeSelect {...form.register("locationId")}>
                <option value="">{tForm("noLocation")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              id="add-serial"
              label={tForm("serial")}
              error={fieldError(errors.serialNumber?.message)}
            >
              <Input autoComplete="off" maxLength={80} {...form.register("serialNumber")} />
            </Field>
            <Field
              id="add-manufacturer"
              label={tForm("manufacturer")}
              error={fieldError(errors.manufacturer?.message)}
            >
              <Input maxLength={120} {...form.register("manufacturer")} />
            </Field>
            <Field
              id="add-year"
              label={tForm("manufactureYear")}
              error={fieldError(errors.manufactureYear?.message)}
            >
              <Input inputMode="numeric" maxLength={4} {...form.register("manufactureYear")} />
            </Field>
            {extra.map((field) => (
              <Field
                key={field.key}
                id={`add-field-${field.key}`}
                label={field.label}
                error={fieldError(errors.customFields?.[field.key]?.message)}
              >
                <Input maxLength={200} {...form.register(`customFields.${field.key}`)} />
              </Field>
            ))}
          </div>
          <Field id="add-notes" label={tForm("notes")} error={fieldError(errors.notes?.message)}>
            <Textarea rows={2} autoCapitalize="sentences" {...form.register("notes")} />
          </Field>
          {error && <Alert variant="error">{tErr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
