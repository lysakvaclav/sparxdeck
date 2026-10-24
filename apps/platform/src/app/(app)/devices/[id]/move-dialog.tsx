"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoveIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import type { SiteOption } from "@/lib/records";
import { moveDeviceSchema } from "@/lib/validation";
import { moveDevice } from "../actions";

/**
 * "Move": another building (grouped by customer) and/or location, with a note.
 * The database keeps the history and drops the spot on the old building's plan.
 */
export function MoveDeviceButton({
  deviceId,
  siteId,
  locationId,
  placed,
  sites,
}: {
  deviceId: string;
  siteId: string;
  locationId: string | null;
  /** The device has a spot on a floor plan of its building. */
  placed: boolean;
  sites: SiteOption[];
}) {
  const t = useTranslations("devices.move");
  const tForm = useTranslations("devices.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState(siteId);
  const [location, setLocation] = useState(locationId ?? "");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, ErrorCode>>>({});
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();

  const chosen = sites.find((option) => option.id === site);
  const otherBuilding = site !== siteId;
  const customers = [...new Map(sites.map((option) => [option.customerId, option.customerName]))];

  function reset() {
    setSite(siteId);
    setLocation(locationId ?? "");
    setNote("");
    setFieldErrors({});
    setError(undefined);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = { siteId: site, locationId: location, note };
    const parsed = moveDeviceSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<string, ErrorCode>> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] ??= issue.message as ErrorCode;
      setFieldErrors(errors);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await moveDevice(deviceId, values);
      if (!result.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0)
          setFieldErrors(result.fieldErrors);
        else setError(result.error);
        return;
      }
      setOpen(false);
      toast(t("moved", { site: chosen?.name ?? "" }), "success");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <MoveIcon />
        {t("button")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        icon={MoveIcon}
        closeLabel={tCommon("close")}
      >
        <form noValidate onSubmit={submit} className="space-y-[15px]">
          <Field
            id="move-site"
            label={tForm("site")}
            error={fieldErrors.siteId ? tErr(fieldErrors.siteId) : undefined}
          >
            <NativeSelect
              value={site}
              onChange={(event) => {
                setSite(event.target.value);
                // Locations belong to a building: another building starts without one.
                setLocation(event.target.value === siteId ? (locationId ?? "") : "");
                setFieldErrors({});
              }}
            >
              {customers.map(([customerId, customerName]) => (
                <optgroup key={customerId} label={customerName}>
                  {sites
                    .filter((option) => option.customerId === customerId)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.id === siteId ? ` (${t("current")})` : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="move-location"
            label={tForm("location")}
            hint={chosen && chosen.locations.length === 0 ? tForm("noLocationsHint") : undefined}
            error={fieldErrors.locationId ? tErr(fieldErrors.locationId) : undefined}
          >
            <NativeSelect
              value={location}
              disabled={!chosen || chosen.locations.length === 0}
              onChange={(event) => {
                setLocation(event.target.value);
                setFieldErrors({});
              }}
            >
              <option value="">{tForm("noLocation")}</option>
              {chosen?.locations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="move-note"
            label={t("note")}
            hint={t("noteHint")}
            error={fieldErrors.note ? tErr(fieldErrors.note) : undefined}
          >
            <Textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {otherBuilding && placed && <Alert variant="warning">{t("planWarning")}</Alert>}
          {error && <Alert variant="error">{tErr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner size={16} />}
              {t("confirm")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
