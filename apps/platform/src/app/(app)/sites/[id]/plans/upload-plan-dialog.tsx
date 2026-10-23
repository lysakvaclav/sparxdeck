"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MediaIcon, UploadIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import {
  PlanImageError,
  openPlanSource,
  preparePlan,
  type PlanErrorCode,
  type PlanSource,
  type PreparedPlan,
} from "@/lib/client/plan-image";
import type { ActionResult } from "@/lib/errors";
import { planNameFromFile } from "@/lib/floor-plans";
import { floorPlanSchema, type FloorPlanInput, type FloorPlanValues } from "@/lib/validation";
import { replaceFloorPlanImage, uploadFloorPlan } from "../../plan-actions";

type Location = { id: string; name: string };

/** Errors of the file itself, worded for plans (not the 2 MB logo limit). */
const FILE_ERRORS: readonly string[] = ["fileTooLarge", "fileTypeInvalid", "planUnreadable"];

/**
 * Uploads a new floor plan of a building, or a new image for an existing one.
 * The file is prepared in the browser first (PDF page rendered, scaled down) and
 * previewed, so what gets uploaded is what the user saw.
 */
export function UploadPlanDialog({
  siteId,
  locations,
  open,
  onOpenChange,
  replace,
}: {
  siteId: string;
  locations: Location[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Replace the image of this plan instead of adding a new one. */
  replace?: { planId: string };
}) {
  const t = useTranslations("plans.form");
  const tPlans = useTranslations("plans");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const fieldError = useFieldError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<PlanSource | null>(null);
  const [page, setPage] = useState(1);
  const [prepared, setPrepared] = useState<(PreparedPlan & { page: number }) | null>(null);
  // Only the latest rendering counts (pages switched quickly finish out of order).
  const renders = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<PlanErrorCode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // The name the dialog filled in itself (from the file or the floor): replaced
  // by a better guess, while a name the user typed stays.
  const [autoName, setAutoName] = useState("");

  function suggestName(name: string) {
    const current = form.getValues("name");
    if (current && current !== autoName) return;
    setAutoName(name);
    form.setValue("name", name, { shouldValidate: Boolean(current) });
  }

  const form = useForm<FloorPlanInput, unknown, FloorPlanValues>({
    resolver: zodResolver(floorPlanSchema),
    defaultValues: { name: "", locationId: "" },
  });
  const { error, pending, run } = useActionForm(form);
  const { errors } = form.formState;

  // Preview URLs are blobs; release the old one.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setSource(null);
    setPrepared(null);
    setPreview(null);
    setFileError(null);
    setPage(1);
    setAutoName("");
    form.reset({ name: "", locationId: "" });
  }

  async function render(next: PlanSource, pageNumber: number) {
    const current = ++renders.current;
    setPreparing(true);
    setFileError(null);
    try {
      const plan = await preparePlan(next, pageNumber);
      if (current !== renders.current) return;
      setPrepared({ ...plan, page: pageNumber });
      setPreview(URL.createObjectURL(plan.blob));
    } catch (failure) {
      if (current !== renders.current) return;
      setPrepared(null);
      setPreview(null);
      setFileError(failure instanceof PlanImageError ? failure.code : "planUnreadable");
    } finally {
      if (current === renders.current) setPreparing(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setPreparing(true);
    setFileError(null);
    try {
      const opened = await openPlanSource(file);
      setSource(opened);
      setPage(1);
      if (!form.getValues("locationId")) suggestName(planNameFromFile(file.name));
      await render(opened, 1);
    } catch (failure) {
      setSource(null);
      setPrepared(null);
      setPreview(null);
      setFileError(failure instanceof PlanImageError ? failure.code : "planUnreadable");
      setPreparing(false);
    }
  }

  function body(): FormData {
    const data = new FormData();
    const type = prepared!.blob.type;
    const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
    data.set("image", new File([prepared!.blob], `plan.${ext}`, { type }));
    return data;
  }

  function submit(values: FloorPlanValues) {
    if (!prepared) return;
    const data = body();
    if (replace) {
      run(
        () => replaceFloorPlanImage(replace.planId, data),
        () => {
          onOpenChange(false);
          reset();
          router.refresh();
        },
      );
      return;
    }
    data.set("name", values.name);
    data.set("locationId", values.locationId ?? "");
    let created: string | null = null;
    run(
      async (): Promise<ActionResult> => {
        const result = await uploadFloorPlan(siteId, data);
        if (!result.ok) return result;
        created = result.data.id;
        return { ok: true };
      },
      () => {
        onOpenChange(false);
        reset();
        if (created) router.push(`/sites/${siteId}/plans/${created}`);
      },
    );
  }

  const busy = preparing || pending;
  const serverFileError = error && FILE_ERRORS.includes(error) ? error : null;
  const shownFileError = fileError ?? serverFileError;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
      title={replace ? t("replaceTitle") : tPlans("upload")}
      icon={UploadIcon}
      closeLabel={tCommon("close")}
      className="max-w-[640px]"
    >
      <form
        noValidate
        onSubmit={
          replace
            ? (event) => {
                event.preventDefault();
                submit({ name: "-", locationId: null });
              }
            : form.handleSubmit(submit)
        }
        className="space-y-4"
      >
        {replace && <p className="text-ui text-muted-foreground">{t("replaceHint")}</p>}

        <div className="space-y-[5px]">
          <p className="text-ui font-semibold" id="plan-file-label">
            {t("file")}
          </p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void onFile(event.dataTransfer.files[0]);
            }}
            className={
              "flex min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-md bg-background p-3 text-center shadow-[inset_0_0_0_1px_var(--border)] " +
              (dragOver ? "shadow-[inset_0_0_0_2px_var(--ring)]" : "")
            }
          >
            {preparing ? (
              <Spinner label={t("preparing")} size={28} />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img
                src={preview}
                alt={t("preview")}
                data-page={prepared?.page}
                className="max-h-[260px] max-w-full rounded-sm bg-white object-contain shadow-elevation-1"
              />
            ) : (
              <MediaIcon size={20} className="text-subtle" />
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-labelledby="plan-file-label"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <MediaIcon />
                {prepared ? t("chooseOther") : t("choose")}
              </Button>
              <span className="hidden text-ui text-muted-foreground sm:inline">{t("drop")}</span>
            </div>
          </div>
          {shownFileError ? (
            <p className="text-ui-sm text-destructive-text" role="alert">
              {t(`errors.${shownFileError as PlanErrorCode}`)}
            </p>
          ) : (
            <p className="text-ui-sm text-muted-foreground">{t("fileHint")}</p>
          )}
        </div>

        {source?.kind === "pdf" && source.pages > 1 && (
          <Field id="plan-page" label={t("page")}>
            <NativeSelect
              value={page}
              disabled={busy}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPage(next);
                void render(source, next);
              }}
            >
              {Array.from({ length: source.pages }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {t("pageOption", { page: index + 1, pages: source.pages })}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        {!replace && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="plan-name" label={t("name")} error={fieldError(errors.name?.message)}>
              <Input
                placeholder={t("namePlaceholder")}
                maxLength={200}
                {...form.register("name")}
              />
            </Field>
            <Field
              id="plan-location"
              label={t("location")}
              hint={t("locationHint")}
              error={fieldError(errors.locationId?.message)}
            >
              <NativeSelect
                {...form.register("locationId", {
                  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                    // A plan of a floor is usually named after it.
                    const location = locations.find((item) => item.id === event.target.value);
                    if (location) suggestName(location.name);
                  },
                })}
              >
                <option value="">{t("locationNone")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}

        {error && !serverFileError && <Alert variant="error">{tErr(error)}</Alert>}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={busy || !prepared}>
            {pending ? t("uploading") : replace ? t("replaceSubmit") : t("submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
