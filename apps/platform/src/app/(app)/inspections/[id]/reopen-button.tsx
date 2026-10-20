"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EditIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { reopenInspection } from "../actions";

/**
 * Reopens a completed inspection for a correction (owner or admin): it becomes
 * "in progress" again, with the usual check screens, and completing it once
 * more reissues the protocol as a new version.
 */
export function ReopenInspectionButton({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("inspections");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await reopenInspection(inspectionId, { reason });
    setPending(false);
    if (!result.ok) {
      setError(tErr(result.error));
      return;
    }
    setOpen(false);
    toast(t("reopen.done"), "success");
    router.push(`/inspections/${inspectionId}`);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setReason("");
          setError(null);
          setOpen(true);
        }}
      >
        <EditIcon />
        {t("reopen.action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("reopen.title")}
        description={t("reopen.description")}
        confirmLabel={t("reopen.confirm")}
        cancelLabel={tCommon("cancel")}
        pending={pending}
        onConfirm={confirm}
      >
        <Textarea
          rows={3}
          aria-label={t("reopen.reasonLabel")}
          placeholder={t("reopen.reasonPlaceholder")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && <p className="mt-2 text-ui-sm text-destructive-text">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
