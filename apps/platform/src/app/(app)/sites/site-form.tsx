"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { LocateIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { captureScanLocation } from "@/lib/client/scan-location";
import { SCAN_LOCATION_RULES } from "@/lib/scan-location";
import { siteSchema, type SiteInput } from "@/lib/validation";
import { createSite, updateSite } from "./actions";

const EMPTY: SiteInput = {
  name: "",
  address: "",
  accessNotes: "",
  notes: "",
  coordinates: "",
  radius: String(SCAN_LOCATION_RULES.defaultRadiusM),
};

type SiteFormProps =
  | { mode: "create"; customerId: string; defaults?: undefined; siteId?: undefined }
  | { mode: "edit"; siteId: string; defaults: SiteInput; customerId?: undefined };

/**
 * Create a site under a customer, or edit one. Goes to the site's page on
 * success. Its point (for the location of QR scans) is typed, pasted from a map
 * application or taken from the phone at the building; no address is looked up.
 */
export function SiteForm(props: SiteFormProps) {
  const t = useTranslations("sites.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const router = useRouter();
  const form = useForm<SiteInput, unknown, z.output<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: props.defaults ?? EMPTY,
  });
  const { error, done, pending, run } = useActionForm(form);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<{ text: string; warn: boolean } | null>(null);

  async function locateMe() {
    setLocating(true);
    setLocated(null);
    const capture = await captureScanLocation();
    setLocating(false);
    if ("error" in capture) {
      setLocated({ text: t(`locateFailed.${capture.error}`), warn: true });
      return;
    }
    form.setValue(
      "coordinates",
      `${capture.latitude.toFixed(6)}, ${capture.longitude.toFixed(6)}`,
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("locationSource", "device", { shouldDirty: true });
    const accuracy = Math.round(capture.accuracyM);
    const imprecise = capture.accuracyM > SCAN_LOCATION_RULES.maxAccuracyM;
    setLocated({ text: t(imprecise ? "locatedImprecise" : "located", { accuracy }), warn: imprecise });
  }
  const { errors } = form.formState;
  const cancelHref =
    props.mode === "edit" ? `/sites/${props.siteId}` : `/customers/${props.customerId}`;

  function submit() {
    const values = form.getValues();
    if (props.mode === "edit") {
      const { siteId } = props;
      run(
        () => updateSite(siteId, values),
        () => router.push(`/sites/${siteId}`),
      );
      return;
    }
    let createdId: string | undefined;
    run(
      async () => {
        const result = await createSite(props.customerId, values);
        if (result.ok) createdId = result.data.id;
        return result;
      },
      () => createdId && router.push(`/sites/${createdId}`),
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="space-y-[15px] p-[15px]">
        <Field id="name" label={t("name")} error={fieldError(errors.name?.message)}>
          <Input
            autoComplete="off"
            placeholder={t("namePlaceholder")}
            autoFocus={props.mode === "create"}
            {...form.register("name")}
          />
        </Field>
        <Field id="address" label={t("address")} error={fieldError(errors.address?.message)}>
          <Textarea rows={2} autoComplete="street-address" {...form.register("address")} />
        </Field>
        <div className="space-y-2.5 border-t border-border pt-[15px]">
          <div>
            <h2 className="text-ui font-semibold">{t("locationTitle")}</h2>
            <p className="text-ui-sm text-muted-foreground">{t("locationHint")}</p>
          </div>
          <Field
            id="coordinates"
            label={t("coordinates")}
            hint={t("coordinatesHint")}
            error={fieldError(errors.coordinates?.message)}
          >
            <Input
              autoComplete="off"
              inputMode="text"
              placeholder="50.0755, 14.4378"
              {...form.register("coordinates", {
                onChange: () => form.setValue("locationSource", "manual"),
              })}
            />
          </Field>
          <input type="hidden" {...form.register("locationSource")} />
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locating}
              onClick={() => void locateMe()}
            >
              <LocateIcon />
              {locating ? t("locating") : t("useMyLocation")}
            </Button>
            {located && (
              <span
                role="status"
                className={located.warn ? "text-ui-sm text-warning-text" : "text-ui-sm text-muted-foreground"}
              >
                {located.text}
              </span>
            )}
          </div>
          <Field
            id="radius"
            label={t("radius")}
            hint={t("radiusHint")}
            error={fieldError(errors.radius?.message)}
            className="max-w-48"
          >
            <Input
              type="number"
              inputMode="numeric"
              min={SCAN_LOCATION_RULES.minRadiusM}
              max={SCAN_LOCATION_RULES.maxRadiusM}
              step={10}
              {...form.register("radius")}
            />
          </Field>
        </div>
        <Field
          id="accessNotes"
          label={t("accessNotes")}
          hint={t("accessNotesHint")}
          error={fieldError(errors.accessNotes?.message)}
        >
          <Textarea
            rows={3}
            placeholder={t("accessNotesPlaceholder")}
            {...form.register("accessNotes")}
          />
        </Field>
        <Field id="notes" label={t("notes")} error={fieldError(errors.notes?.message)}>
          <Textarea rows={3} {...form.register("notes")} />
        </Field>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {/* Success navigates away; until then a second click must not save twice. */}
        <Button type="submit" disabled={pending || done}>
          {props.mode === "edit" ? tCommon("save") : t("create")}
        </Button>
      </CardFooter>
    </form>
  );
}
