"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { clearInspectionDrafts } from "@/lib/client/check-drafts";
import { forgetInspection } from "@/lib/client/offline-store";
import { removeQueuedPhotos } from "@/lib/client/photo-queue";
import { cancelInspection } from "../actions";

/** "Cancel inspection" for one started by mistake (whoever started it, owners, admins). */
export function CancelInspectionButton({
  inspectionId,
  disabled = false,
}: {
  inspectionId: string;
  /** Without a signal: cancelling needs the server. */
  disabled?: boolean;
}) {
  const t = useTranslations("inspections.cancel");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await cancelInspection(inspectionId);
      if (!result.ok) {
        setOpen(false);
        toast(tErr(result.error), "danger");
        return;
      }
      // What this phone kept for the cancelled inspection goes with it.
      clearInspectionDrafts(inspectionId);
      await removeQueuedPhotos(inspectionId);
      await forgetInspection(inspectionId);
      toast(t("done"), "success");
      router.push(`/sites/${result.data.siteId}`);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        <CrossIcon />
        {t("action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={t("title")}
        description={t("body")}
        confirmLabel={t("confirm")}
        cancelLabel={t("keep")}
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
