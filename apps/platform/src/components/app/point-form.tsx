"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocateIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { captureScanLocation } from "@/lib/client/scan-location";
import type { ActionResult } from "@/lib/errors";
import { SCAN_LOCATION_RULES, parseCoordinates, type Coordinates } from "@/lib/scan-location";

/** As a building's point is written ("50.075500, 14.437800"). */
export function pointText(point: Coordinates | null): string {
  return point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "";
}

/**
 * A point kept for later (the company's seat, a member's home; part 23):
 * typed, pasted from a map application or taken from the phone. Nothing is
 * looked up from an address.
 */
export function PointForm({
  id,
  label,
  initial,
  save,
  disabled = false,
}: {
  id: string;
  label: string;
  initial: Coordinates | null;
  save: (input: { coordinates: string }) => Promise<ActionResult>;
  /** Seen, not changed (a technician in Settings). */
  disabled?: boolean;
}) {
  const t = useTranslations("point");
  const tSite = useTranslations("sites.form");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(pointText(initial));
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<{ text: string; warn: boolean } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();

  async function locate() {
    setLocating(true);
    setStatus(null);
    const capture = await captureScanLocation();
    setLocating(false);
    if ("error" in capture) {
      setStatus({ text: tSite(`locateFailed.${capture.error}`), warn: true });
      return;
    }
    setValue(pointText(capture));
    setError(undefined);
    const accuracy = Math.round(capture.accuracyM);
    const imprecise = capture.accuracyM > SCAN_LOCATION_RULES.maxAccuracyM;
    setStatus({ text: tSite(imprecise ? "locatedImprecise" : "located", { accuracy }), warn: imprecise });
  }

  const submit = (coordinates: string) =>
    start(async () => {
      if (coordinates && !parseCoordinates(coordinates)) {
        setError(tErr("invalidCoordinates"));
        return;
      }
      setError(undefined);
      const result = await save({ coordinates });
      if (!result.ok) {
        setError(tErr(result.fieldErrors?.coordinates ?? result.error));
        return;
      }
      setStatus(null);
      if (!coordinates) setValue("");
      toast(coordinates ? t("saved") : t("cleared"), "success");
      router.refresh();
    });

  return (
    <form
      className="space-y-2.5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(value.trim());
      }}
    >
      <Field id={id} label={label} hint={t("hint")} error={error} className="max-w-md">
        <Input
          value={value}
          autoComplete="off"
          placeholder="50.0755, 14.4378"
          maxLength={100}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <div className={disabled ? "hidden" : "flex flex-wrap items-center gap-2"}>
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={locating || pending} onClick={() => void locate()}>
          <LocateIcon />
          {locating ? tSite("locating") : tSite("useMyLocation")}
        </Button>
        {initial && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => submit("")}>
            {t("clear")}
          </Button>
        )}
        {status && (
          <span role="status" className={status.warn ? "text-ui-sm text-warning-text" : "text-ui-sm text-muted-foreground"}>
            {status.text}
          </span>
        )}
      </div>
    </form>
  );
}
