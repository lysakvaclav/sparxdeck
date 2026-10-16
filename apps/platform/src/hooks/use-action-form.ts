"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult, ErrorCode } from "@/lib/errors";

/**
 * Runs a server action for a React Hook Form form: field errors from the server
 * land on their fields, anything else becomes `error` for an alert, and `done`
 * flips to true on success (for a "Saved" message).
 */
export function useActionForm<T extends FieldValues, C = unknown, R = T>(
  form: UseFormReturn<T, C, R>,
) {
  const [error, setError] = useState<ErrorCode>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(undefined);
    setDone(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setDone(true);
        onSuccess?.();
        return;
      }
      const fieldEntries = Object.entries(result.fieldErrors ?? {});
      if (fieldEntries.length > 0) {
        for (const [field, code] of fieldEntries) {
          form.setError(field as Path<T>, { message: code });
        }
      } else {
        setError(result.error);
      }
    });
  }

  return { error, done, pending, run };
}

/** Translates a field's error message (an ErrorCode) for display under the field. */
export function useFieldError() {
  const tErr = useTranslations("errors");
  return (message?: string) => (message ? tErr(message as ErrorCode) : undefined);
}
