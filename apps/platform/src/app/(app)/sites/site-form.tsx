"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm, useFieldError } from "@/hooks/use-action-form";
import { siteSchema, type SiteInput } from "@/lib/validation";
import { createSite, updateSite } from "./actions";

const EMPTY: SiteInput = { name: "", address: "", accessNotes: "", notes: "" };

type SiteFormProps =
  | { mode: "create"; customerId: string; defaults?: undefined; siteId?: undefined }
  | { mode: "edit"; siteId: string; defaults: SiteInput; customerId?: undefined };

/** Create a site under a customer, or edit one. Goes to the site's page on success. */
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
      <div className="space-y-4 p-5">
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
