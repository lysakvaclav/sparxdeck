"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarIcon, TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import { inspectionPlanSchema } from "@/lib/validation";
import { createPlan, deletePlan, updatePlan } from "@/app/(app)/calendar/actions";

export type PlanSiteOption = { id: string; name: string; customerId: string; customerName: string };
export type PlanMember = { id: string; name: string };
export type PlanValues = {
  id?: string;
  siteId: string;
  plannedOn: string;
  technicianId: string;
  note: string;
};

/**
 * Plans a visit (a building, a day, a technician, a note) or edits one not
 * carried out yet. Owners and admins only; the server checks again.
 */
export function PlanDialog({
  open,
  onOpenChange,
  initial,
  sites,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PlanValues;
  sites: readonly PlanSiteOption[];
  members: readonly PlanMember[];
}) {
  const t = useTranslations("calendar.plan");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, ErrorCode>>>({});
  const [error, setError] = useState<ErrorCode>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(initial.id);
  const customers = [...new Map(sites.map((site) => [site.customerId, site.customerName]))];

  // Each opening starts from the given values (adjusting state while rendering,
  // as React recommends for resetting on a prop change).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValues(initial);
      setFieldErrors({});
      setError(undefined);
      setConfirmDelete(false);
    }
  }

  function change(patch: Partial<PlanValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setFieldErrors({});
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      siteId: values.siteId,
      plannedOn: values.plannedOn,
      technicianId: values.technicianId,
      note: values.note,
    };
    const parsed = inspectionPlanSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Partial<Record<string, ErrorCode>> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] ??= issue.message as ErrorCode;
      setFieldErrors(errors);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = initial.id ? await updatePlan(initial.id, input) : await createPlan(input);
      if (!result.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0)
          setFieldErrors(result.fieldErrors);
        else setError(result.error);
        return;
      }
      onOpenChange(false);
      toast(editing ? t("updated") : t("created"), "success");
      router.refresh();
    });
  }

  function remove() {
    if (!initial.id) return;
    const id = initial.id;
    startTransition(async () => {
      const result = await deletePlan(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      toast(t("deleted"), "success");
      router.refresh();
    });
  }

  const fieldError = (key: string) => (fieldErrors[key] ? tErr(fieldErrors[key]!) : undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("editTitle") : t("title")}
      icon={CalendarIcon}
      closeLabel={tCommon("close")}
    >
      <form noValidate onSubmit={submit} className="space-y-[15px]">
        <Field id="plan-site" label={t("site")} error={fieldError("siteId")}>
          <NativeSelect value={values.siteId} onChange={(e) => change({ siteId: e.target.value })}>
            {!values.siteId && <option value="">{t("sitePlaceholder")}</option>}
            {customers.map(([customerId, customerName]) => (
              <optgroup key={customerId} label={customerName}>
                {sites
                  .filter((site) => site.customerId === customerId)
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-1 gap-[15px] sm:grid-cols-2">
          <Field id="plan-date" label={t("date")} error={fieldError("plannedOn")}>
            <Input
              type="date"
              value={values.plannedOn}
              onChange={(e) => change({ plannedOn: e.target.value })}
            />
          </Field>
          <Field id="plan-technician" label={t("technician")} error={fieldError("technicianId")}>
            <NativeSelect
              value={values.technicianId}
              onChange={(e) => change({ technicianId: e.target.value })}
            >
              <option value="">{t("unassigned")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field id="plan-note" label={t("note")} hint={t("noteHint")} error={fieldError("note")}>
          <Textarea
            rows={2}
            maxLength={1000}
            value={values.note}
            onChange={(e) => change({ note: e.target.value })}
          />
        </Field>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
        {confirmDelete && (
          <Alert variant="warning" title={t("deleteTitle")}>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={remove}
              >
                {t("deleteConfirm")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                {tCommon("cancel")}
              </Button>
            </div>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing && !confirmDelete && (
            <Button
              type="button"
              variant="destructiveMinimal"
              className="me-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <TrashIcon />
              {t("delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner size={16} />}
            {editing ? tCommon("save") : t("confirm")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** A button that opens the planning dialog with preset values. */
export function PlanButton({
  initial,
  sites,
  members,
  label,
  variant = "outline",
}: {
  initial: PlanValues;
  sites: readonly PlanSiteOption[];
  members: readonly PlanMember[];
  label: string;
  variant?: "outline" | "primary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <CalendarIcon />
        {label}
      </Button>
      <PlanDialog
        open={open}
        onOpenChange={setOpen}
        initial={initial}
        sites={sites}
        members={members}
      />
    </>
  );
}
