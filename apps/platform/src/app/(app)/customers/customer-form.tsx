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
import { customerSchema, type CustomerInput } from "@/lib/validation";
import { createCustomer, updateCustomer } from "./actions";

const EMPTY: CustomerInput = {
  name: "",
  companyId: "",
  vatId: "",
  contactPerson: "",
  email: "",
  phone: "",
  billingAddress: "",
  notes: "",
};

/** Create (no `customerId`) or edit a customer. Goes to the detail page on success. */
export function CustomerForm({
  customerId,
  defaults = EMPTY,
}: {
  customerId?: string;
  defaults?: CustomerInput;
}) {
  const t = useTranslations("customers.form");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const fieldError = useFieldError();
  const router = useRouter();
  const form = useForm<CustomerInput, unknown, z.output<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
  });
  const { error, done, pending, run } = useActionForm(form);
  const { errors } = form.formState;
  const cancelHref = customerId ? `/customers/${customerId}` : "/customers";

  function submit() {
    const values = form.getValues();
    if (customerId) {
      run(
        () => updateCustomer(customerId, values),
        () => router.push(`/customers/${customerId}`),
      );
      return;
    }
    let createdId: string | undefined;
    run(
      async () => {
        const result = await createCustomer(values);
        if (result.ok) createdId = result.data.id;
        return result;
      },
      () => createdId && router.push(`/customers/${createdId}`),
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            id="name"
            label={t("name")}
            error={fieldError(errors.name?.message)}
            className="md:col-span-2"
          >
            <Input
              autoComplete="organization"
              placeholder={t("namePlaceholder")}
              autoFocus={!customerId}
              {...form.register("name")}
            />
          </Field>
          <Field
            id="companyId"
            label={t("companyId")}
            error={fieldError(errors.companyId?.message)}
          >
            <Input inputMode="numeric" autoComplete="off" {...form.register("companyId")} />
          </Field>
          <Field id="vatId" label={t("vatId")} error={fieldError(errors.vatId?.message)}>
            <Input autoComplete="off" className="uppercase" {...form.register("vatId")} />
          </Field>
          <Field
            id="contactPerson"
            label={t("contactPerson")}
            error={fieldError(errors.contactPerson?.message)}
            className="md:col-span-2"
          >
            <Input autoComplete="off" {...form.register("contactPerson")} />
          </Field>
          <Field
            id="email"
            label={t("email")}
            hint={t("emailHint")}
            error={fieldError(errors.email?.message)}
          >
            <Input type="email" inputMode="email" autoComplete="off" {...form.register("email")} />
          </Field>
          <Field id="phone" label={t("phone")} error={fieldError(errors.phone?.message)}>
            <Input type="tel" inputMode="tel" autoComplete="off" {...form.register("phone")} />
          </Field>
          <Field
            id="billingAddress"
            label={t("billingAddress")}
            error={fieldError(errors.billingAddress?.message)}
            className="md:col-span-2"
          >
            <Textarea rows={3} {...form.register("billingAddress")} />
          </Field>
          <Field
            id="notes"
            label={t("notes")}
            error={fieldError(errors.notes?.message)}
            className="md:col-span-2"
          >
            <Textarea rows={4} placeholder={t("notesPlaceholder")} {...form.register("notes")} />
          </Field>
        </div>
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </div>
      <CardFooter>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
        {/* Success navigates away; until then a second click must not save twice. */}
        <Button type="submit" disabled={pending || done}>
          {customerId ? tCommon("save") : t("create")}
        </Button>
      </CardFooter>
    </form>
  );
}
