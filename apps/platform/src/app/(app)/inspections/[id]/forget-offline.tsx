"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ErrorIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clearInspectionDrafts, devicesWithDrafts, readOps } from "@/lib/client/check-drafts";
import { forgetInspection } from "@/lib/client/offline-store";
import { queuedPhotoCounts, removeQueuedPhotos } from "@/lib/client/photo-queue";

/**
 * A completed inspection: the phone no longer needs its download. Changes the
 * phone didn't manage to send before it was completed can't be saved any more;
 * they are named so the technician knows, then dropped.
 */
export function ForgetOffline({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("inspections.field");
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const photos = Object.values(await queuedPhotoCounts(inspectionId)).reduce(
        (sum, n) => sum + n,
        0,
      );
      const waiting =
        devicesWithDrafts(inspectionId).length + readOps(inspectionId).length + photos;
      if (cancelled) return;
      if (waiting > 0) setLeft(waiting);
      else await forgetInspection(inspectionId);
    })();
    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  if (left === 0) return null;
  return (
    <Alert
      variant="error"
      icon={ErrorIcon}
      title={t("closedCompleted")}
      className="mb-2.5 sm:mb-[15px]"
    >
      <p>{t("leftInPhone", { count: left })}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2.5"
        onClick={async () => {
          clearInspectionDrafts(inspectionId);
          await removeQueuedPhotos(inspectionId);
          await forgetInspection(inspectionId);
          setLeft(0);
        }}
      >
        {t("discardAll")}
      </Button>
    </Alert>
  );
}
