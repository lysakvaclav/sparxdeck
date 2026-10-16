"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon, NewObjectIcon, TrashIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/errors";
import { createSampleData, dismissGuide, removeSampleData } from "./guide-actions";

/** "Add sample data": a sample customer to try the app on. */
export function CreateSampleButton() {
  const t = useTranslations("guide");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createSampleData();
          if (!result.ok) {
            toast(tErr(result.error), "danger");
            return;
          }
          toast(t("sampleCreated"), "success");
          router.refresh();
        })
      }
    >
      {pending ? <Spinner size={16} /> : <NewObjectIcon />}
      {t("sampleCreate")}
    </Button>
  );
}

/** "Remove sample data", after a confirmation that says what goes with it. */
export function RemoveSampleButton() {
  const t = useTranslations("guide");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        className="[&_svg]:text-destructive-text"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <TrashIcon />
        {t("sampleRemove")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("sampleRemoveTitle")}
        description={t("sampleRemoveBody")}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await removeSampleData();
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            toast(t("sampleRemoved"), "success");
            router.refresh();
          })
        }
      >
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </ConfirmDialog>
    </>
  );
}

/** Hides the guide for the company. */
export function DismissGuideButton() {
  const t = useTranslations("guide");
  const tErr = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await dismissGuide();
          if (!result.ok) {
            toast(tErr(result.error), "danger");
            return;
          }
          router.refresh();
        })
      }
    >
      <CrossIcon />
      {t("dismiss")}
    </Button>
  );
}
