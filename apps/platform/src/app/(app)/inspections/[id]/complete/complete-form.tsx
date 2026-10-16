"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { ConfirmIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { completeInspectionSchema, type CompleteInspectionInput } from "@/lib/validation";
import { completeInspection } from "../../actions";

export function CompleteForm({
  inspectionId,
  blocked,
}: {
  inspectionId: string;
  blocked: boolean;
}) {
  const t = useTranslations("inspections");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const router = useRouter();
  const toast = useToast();
  const form = useForm<CompleteInspectionInput, unknown, z.output<typeof completeInspectionSchema>>(
    {
      resolver: zodResolver(completeInspectionSchema),
      defaultValues: { notes: "" },
    },
  );
  const { error, done, pending, run } = useActionForm(form);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() => {
        let defects = 0;
        run(
          async () => {
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
      })}
    >
      <div className="space-y-[15px] p-[15px]">
        <p className="text-ui text-muted-foreground">{t("complete.datesHint")}</p>
        <Field
          id="notes"
          label={t("complete.notes")}
          error={fieldError(form.formState.errors.notes?.message)}
        >
          <Textarea rows={3} {...form.register("notes")} />
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
