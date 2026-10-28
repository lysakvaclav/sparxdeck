"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, EditIcon, RouteIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import { createRoute, updateRoute } from "./actions";

type Values = { plannedOn: string; technicianId: string; name: string };

/**
 * A new route, or a route's day, technician and name (part 23). Owners and
 * admins choose the technician; a technician plans their own.
 */
export function RouteDialog({
  routeId,
  initial,
  members,
  canChooseTechnician,
  variant = "primary",
}: {
  /** Editing this route; a new one without it. */
  routeId?: string;
  initial: Values;
  members: { id: string; name: string }[];
  canChooseTechnician: boolean;
  variant?: "primary" | "outline";
}) {
  const t = useTranslations("routes");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Values | "form", ErrorCode>>>({});
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setErrors({});
      const refused = (result: { error: ErrorCode; fieldErrors?: Partial<Record<string, ErrorCode>> }) => {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.keys(fields).length ? fields : { form: result.error });
      };
      if (routeId) {
        const result = await updateRoute(routeId, values);
        if (!result.ok) return refused(result);
        setOpen(false);
        toast(t("edit.saved"), "success");
        router.refresh();
        return;
      }
      const result = await createRoute(values);
      if (!result.ok) return refused(result);
      setOpen(false);
      router.push(`/routes/${result.data.id}`);
    });

  const field = (key: keyof Values) => (errors[key] ? tErr(errors[key]) : undefined);
  const prefix = routeId ? "route-edit" : "route-new";

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setValues(initial);
          setErrors({});
          setOpen(true);
        }}
      >
        {routeId ? <EditIcon /> : <AddIcon />}
        {routeId ? t("edit.button") : t("new.button")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={routeId ? t("edit.title") : t("new.title")}
        icon={RouteIcon}
        closeLabel={tCommon("close")}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field id={`${prefix}-day`} label={t("new.day")} error={field("plannedOn")}>
            <Input
              type="date"
              required
              value={values.plannedOn}
              onChange={(event) => setValues({ ...values, plannedOn: event.target.value })}
            />
          </Field>
          {canChooseTechnician && (
            <Field id={`${prefix}-technician`} label={t("new.technician")} error={field("technicianId")}>
              <NativeSelect
                value={values.technicianId}
                onChange={(event) => setValues({ ...values, technicianId: event.target.value })}
              >
                <option value="">{t("unassigned")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id={`${prefix}-name`} label={t("new.name")} error={field("name")}>
            <Input
              value={values.name}
              maxLength={120}
              placeholder={t("new.namePlaceholder")}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>
          {routeId && <p className="text-ui-sm text-muted-foreground">{t("edit.hint")}</p>}
          {errors.form && (
            <p role="alert" className="text-ui-sm text-destructive-text">
              {tErr(errors.form)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {routeId ? t("edit.submit") : t("new.submit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
