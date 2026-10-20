"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { ConfirmIcon, EraserIcon } from "@/components/icons";
import { SignaturePad, type SignaturePadHandle } from "@/components/app/signature-pad";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { completeInspectionSchema, type CompleteInspectionInput } from "@/lib/validation";
import { completeInspection } from "../../actions";

export function CompleteForm({
  inspectionId,
  blocked,
  correction,
  defaultNotes,
  signedBefore,
}: {
  inspectionId: string;
  blocked: boolean;
  /** Reopened for a fix: completing again reissues the protocol as a new version. */
  correction: boolean;
  /** A correction starts from the notes the inspection already has. */
  defaultNotes: string;
  /** The customer signed before (a correction keeps it unless signed again). */
  signedBefore: boolean;
}) {
  const t = useTranslations("inspections");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const router = useRouter();
  const toast = useToast();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const form = useForm<CompleteInspectionInput, unknown, z.output<typeof completeInspectionSchema>>(
    {
      resolver: zodResolver(completeInspectionSchema),
      defaultValues: { notes: defaultNotes, signature: "", signerName: "" },
    },
  );
  const { error, done, pending, run } = useActionForm(form);

  function onSubmit() {
    let defects = 0;
    run(
      async () => {
        // The server validates its own way (notes/signature/name as plain
        // strings); getValues() gives it those, not the client's transformed
        // output (empty strings turned to null).
        const result = await completeInspection(inspectionId, form.getValues());
        if (result.ok) defects = result.data.defects;
        return result;
      },
      () => {
        toast(
          defects > 0 ? t("complete.doneWithDefects", { count: defects }) : t("complete.done"),
          "success",
        );
        router.push(`/inspections/${inspectionId}`);
        router.refresh();
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        // The signature lives on a canvas, not a registered field: read it into
        // form state before react-hook-form validates and calls onSubmit.
        form.setValue("signature", signatureRef.current?.toPngBase64() ?? "");
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      <div className="space-y-[15px] p-[15px]">
        {correction && <Alert variant="warning">{t("complete.correctionHint")}</Alert>}
        <p className="text-ui text-muted-foreground">{t("complete.datesHint")}</p>
        <Field
          id="notes"
          label={t("complete.notes")}
          error={fieldError(form.formState.errors.notes?.message)}
        >
          <Textarea rows={3} {...form.register("notes")} />
        </Field>
        <div className="space-y-1.5">
          <p className="text-ui-sm font-medium">{t("complete.signatureTitle")}</p>
          <p className="text-ui-sm text-muted-foreground">
            {correction && signedBefore
              ? t("complete.signatureKeptHint")
              : t("complete.signatureHint")}
          </p>
          <SignaturePad ref={signatureRef} label={t("complete.signatureTitle")} className="h-40 w-full" />
          <Button type="button" variant="ghost" size="sm" onClick={() => signatureRef.current?.clear()}>
            <EraserIcon />
            {t("complete.signatureClear")}
          </Button>
        </div>
        <Field
          id="signerName"
          label={t("complete.signerName")}
          error={fieldError(form.formState.errors.signerName?.message)}
        >
          <Input {...form.register("signerName")} />
        </Field>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href={`/inspections/${inspectionId}`}>{tCommon("back")}</Link>
        </Button>
        {/* Success navigates away; until then a second click must not complete twice. */}
        <Button type="submit" disabled={blocked || pending || done}>
          <ConfirmIcon />
          {t("complete.confirm")}
        </Button>
      </CardFooter>
    </form>
  );
}
