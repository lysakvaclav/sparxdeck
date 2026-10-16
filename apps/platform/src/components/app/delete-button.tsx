"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ErrorCode } from "@/lib/errors";

/**
 * "Delete" with a confirmation dialog. Runs the action (a bound server action)
 * and, on success, goes to `redirectTo`.
 */
export function DeleteButton({
  title,
  description,
  action,
  redirectTo,
}: {
  title: string;
  description: string;
  action: () => Promise<{ ok: true } | { ok: false; error: ErrorCode }>;
  redirectTo: string;
}) {
  const t = useTranslations("common");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="[&_svg]:text-destructive-text"
      >
        <TrashIcon />
        {t("delete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(undefined);
        }}
        title={title}
        description={description}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        pending={pending}
        onConfirm={confirm}
      >
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </ConfirmDialog>
    </>
  );
}
