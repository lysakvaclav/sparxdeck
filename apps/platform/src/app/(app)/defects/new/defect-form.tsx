"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CameraIcon, SmallCrossIcon } from "@/components/icons";
import { SeverityPicker } from "@/components/app/severity-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/client/image";
import { defectNumber } from "@/lib/defects";
import type { ErrorCode } from "@/lib/errors";
import type { DefectSeverity } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { createDefect, findDeviceByLabel } from "../actions";

type Device = { id: string; name: string; siteName: string };

/** Uploads photos to a defect's folder and registers them. */
export async function uploadDefectPhotos(
  organizationId: string,
  defectId: string,
  blobs: Blob[],
): Promise<boolean> {
  const supabase = createClient();
  for (const blob of blobs) {
    const path = `${organizationId}/defects/${defectId}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage
      .from("org-assets")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (upload.error) return false;
    const { error } = await supabase.rpc("add_defect_photo", {
      p_defect: defectId,
      p_path: path,
      p_content_type: "image/jpeg",
      p_size: blob.size,
    });
    if (error) return false;
  }
  return true;
}

/** Report a defect: the device (fixed, or found by its label number), what's wrong, photos. */
export function DefectForm({
  device: fixed,
  organizationId,
}: {
  device: Device | null;
  organizationId: string;
}) {
  const t = useTranslations("defects");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [found, setFound] = useState<Device | null | "missing">(fixed);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DefectSeverity>("major");
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [errors, setErrors] = useState<Partial<Record<"device" | "description", string>>>({});
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const lookup = useRef(0);
  const device = found && found !== "missing" ? found : null;
  const urls = useMemo(() => photos.map((photo) => photo.url), [photos]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  function findDevice(value: string) {
    setLabel(value);
    const ticket = ++lookup.current;
    if (!value.trim()) {
      setFound(null);
      return;
    }
    void findDeviceByLabel(value).then((result) => {
      if (ticket === lookup.current) setFound(result ?? "missing");
    });
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await compressImage(file);
      setPhotos((list) => [...list, { blob, url: URL.createObjectURL(blob) }]);
    } catch {
      toast(tErr("photoFailed"), "danger");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!device)
      nextErrors.device = found === "missing" ? t("form.deviceNotFound") : tErr("required");
    if (!description.trim()) nextErrors.description = tErr("required");
    setErrors(nextErrors);
    setError(undefined);
    if (Object.keys(nextErrors).length > 0 || !device) return;
    startTransition(async () => {
      const result = await createDefect({ deviceId: device.id, description, severity });
      if (!result.ok) {
        if (result.fieldErrors?.description)
          setErrors({ description: tErr(result.fieldErrors.description) });
        else setError(result.error);
        return;
      }
      setDone(true);
      const uploaded = await uploadDefectPhotos(
        organizationId,
        result.data.id,
        photos.map((photo) => photo.blob),
      );
      if (!uploaded) toast(tErr("photoFailed"), "danger");
      toast(
        t("form.created", { number: t("number", { number: defectNumber(result.data.number) }) }),
        "success",
      );
      router.push(`/defects/${result.data.id}`);
    });
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="space-y-4 p-5">
        {fixed ? (
          <div>
            <p className="text-ui-sm text-muted-foreground">{t("form.device")}</p>
            <p className="font-medium">{fixed.name}</p>
            <p className="text-ui-sm text-muted-foreground">{fixed.siteName}</p>
          </div>
        ) : (
          <Field
            id="defect-device"
            label={t("form.device")}
            hint={device ? `${device.name} · ${device.siteName}` : t("form.deviceHint")}
            error={errors.device ?? (found === "missing" ? t("form.deviceNotFound") : undefined)}
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={label}
              onChange={(event) => findDevice(event.target.value)}
              className="w-40"
            />
          </Field>
        )}
        <Field id="defect-description" label={t("form.description")} error={errors.description}>
          <Textarea
            rows={4}
            placeholder={t("form.descriptionPlaceholder")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-ui font-medium">{t("form.severity")}</p>
          <SeverityPicker
            value={severity}
            onChange={(value) => value && setSeverity(value)}
            label={t("form.severity")}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-ui font-medium">{t("form.photos")}</p>
          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <li key={photo.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img
                    src={photo.url}
                    alt=""
                    className="size-20 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
                  />
                  <button
                    type="button"
                    aria-label={tCommon("delete")}
                    onClick={() => setPhotos((list) => list.filter((_, i) => i !== index))}
                    className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-background shadow-elevation-2 pointer-coarse:size-8"
                  >
                    <SmallCrossIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md surface-button px-3.5 text-ui font-medium whitespace-nowrap transition-colors hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] pointer-coarse:min-h-11 pointer-coarse:px-4">
            <CameraIcon className="text-[var(--btn-icon)]" />
            {t("form.addPhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              data-testid="defect-photo"
              onChange={(event) => {
                void addPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href={fixed ? `/devices/${fixed.id}` : "/defects"}>{tCommon("cancel")}</Link>
        </Button>
        <Button type="submit" disabled={pending || done}>
          {pending && <Spinner size={16} />}
          {t("form.create")}
        </Button>
      </CardFooter>
    </form>
  );
}
