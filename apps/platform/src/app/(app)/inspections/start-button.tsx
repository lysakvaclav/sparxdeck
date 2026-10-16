"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { startInspection } from "./actions";

/**
 * Starts (or joins) the building's inspection and opens it, or one device's check
 * in it when `deviceId` is given.
 */
export function StartInspectionButton({
  siteId,
  deviceId,
  label,
  variant = "primary",
  size,
  className,
}: {
  siteId: string;
  deviceId?: string;
  label?: string;
  variant?: "primary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("inspections");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [started, setStarted] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || started}
      onClick={() =>
        startTransition(async () => {
          const result = await startInspection(siteId);
          if (!result.ok) {
            toast(tErr(result.error), "danger");
            return;
          }
          setStarted(true);
          router.push(
            deviceId
              ? `/inspections/${result.data.id}/check/${deviceId}`
              : `/inspections/${result.data.id}`,
          );
        })
      }
    >
      <PlayIcon />
      {label ?? t("start")}
    </Button>
  );
}
