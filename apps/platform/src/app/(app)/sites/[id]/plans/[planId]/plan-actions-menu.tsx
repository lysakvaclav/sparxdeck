"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EditIcon, MediaIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { floorPlanSchema, type FloorPlanInput, type FloorPlanValues } from "@/lib/validation";
import { updateFloorPlan } from "../../../plan-actions";
import { UploadPlanDialog } from "../upload-plan-dialog";

type Location = { id: string; name: string };

/** Header actions of a plan for owners and admins: edit name and floor, replace the image. */
export function PlanEditActions({
  siteId,
  plan,
  locations,
}: {
  siteId: string;
  plan: { id: string; name: string; locationId: string | null };
  locations: Location[];
}) {
  const t = useTranslations("plans");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const fieldError = useFieldError();
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const form = useForm<FloorPlanInput, unknown, FloorPlanValues>({
    resolver: zodResolver(floorPlanSchema),
    defaultValues: { name: plan.name, locationId: plan.locationId ?? "" },
  });
  const { error, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          form.reset({ name: plan.name, locationId: plan.locationId ?? "" });
          setEditing(true);
        }}
      >
        <EditIcon />
        {t("detail.edit")}
      </Button>
      <Button variant="outline" onClick={() => setReplacing(true)}>
        <MediaIcon />
        {t("detail.replace")}
      </Button>

      <Dialog
        open={editing}
        onOpenChange={(open) => !pending && setEditing(open)}
        title={t("form.editTitle")}
        icon={EditIcon}
        closeLabel={tCommon("close")}
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            run(
              () => updateFloorPlan(plan.id, values),
              () => {
                setEditing(false);
                router.refresh();
              },
            ),
          )}
        >
          <Field
            id="edit-plan-name"
            label={t("form.name")}
            error={fieldError(errors.name?.message)}
          >
            <Input maxLength={200} {...form.register("name")} />
          </Field>
          <Field
            id="edit-plan-location"
            label={t("form.location")}
            hint={t("form.locationHint")}
            error={fieldError(errors.locationId?.message)}
          >
            <NativeSelect {...form.register("locationId")}>
              <option value="">{t("form.locationNone")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {error && <Alert variant="error">{tErr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("form.save")}
            </Button>
          </div>
        </form>
      </Dialog>

      <UploadPlanDialog
        siteId={siteId}
        locations={locations}
        open={replacing}
        onOpenChange={setReplacing}
        replace={{ planId: plan.id }}
      />
    </>
  );
}
