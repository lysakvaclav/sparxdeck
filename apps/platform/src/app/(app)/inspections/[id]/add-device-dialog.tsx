"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { attributeFields, formatLabel } from "@/lib/devices";
import {
  inspectionDeviceSchema,
  type InspectionDeviceInput,
  type InspectionDeviceValues,
} from "@/lib/validation";
import { addInspectionDevice } from "../actions";

export type FieldDeviceType = { id: string; name: string; code: string };
export type FieldLocation = { id: string; name: string };

/**
 * A device the technician finds in the building but not on the list: added to
 * the building (with the next label number) and opened for its check at once.
 */
export function AddDeviceButton({
  inspectionId,
  types,
  locations,
}: {
  inspectionId: string;
  types: FieldDeviceType[];
  locations: FieldLocation[];
}) {
  const t = useTranslations("inspections.addDevice");
  const tForm = useTranslations("devices.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
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
    agent: "",
    size: "",
    notes: "",
  };
  const form = useForm<InspectionDeviceInput, unknown, InspectionDeviceValues>({
    resolver: zodResolver(inspectionDeviceSchema),
    defaultValues: empty,
  });
  const { error, pending, run } = useActionForm(form);
  const { errors } = form.formState;
  const typeId = useWatch({ control: form.control, name: "deviceTypeId" });
  const typeCode = types.find((type) => type.id === typeId)?.code;
  const extra = attributeFields(typeCode);

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
        router.push(`/inspections/${inspectionId}/check/${device.id}`);
      },
    );
  }

  return (
    <>
      <Button size="lg" variant="outline" onClick={() => setOpen(true)} disabled={!types.length}>
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
            {extra.includes("agent") && (
              <Field
                id="add-agent"
                label={tForm("agent")}
                error={fieldError(errors.agent?.message)}
              >
                <Input
                  placeholder={tForm("agentPlaceholder")}
                  maxLength={60}
                  {...form.register("agent")}
                />
              </Field>
            )}
            {extra.includes("size") && (
              <Field id="add-size" label={tForm("size")} error={fieldError(errors.size?.message)}>
                <Input
                  placeholder={tForm("sizePlaceholder")}
                  maxLength={40}
                  {...form.register("size")}
                />
              </Field>
            )}
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
