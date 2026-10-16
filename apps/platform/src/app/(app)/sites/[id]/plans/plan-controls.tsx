"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDownIcon, ArrowUpIcon, MoreIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { reorderFloorPlans } from "../../plan-actions";
import { UploadPlanDialog } from "./upload-plan-dialog";

type Location = { id: string; name: string };

/** "Upload floor plan" with its dialog. */
export function UploadPlanButton({
  siteId,
  locations,
  size = "sm",
  variant = "outline",
}: {
  siteId: string;
  locations: Location[];
  size?: "sm" | "md";
  variant?: "outline" | "primary";
}) {
  const t = useTranslations("plans");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <UploadIcon />
        {t("upload")}
      </Button>
      <UploadPlanDialog siteId={siteId} locations={locations} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Moves a plan up or down among the building's plans. */
export function PlanOrderMenu({
  siteId,
  order,
  index,
  name,
}: {
  siteId: string;
  order: string[];
  index: number;
  name: string;
}) {
  const t = useTranslations("plans");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function move(by: -1 | 1) {
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved!);
    startTransition(async () => {
      const result = await reorderFloorPlans(siteId, next);
      if (!result.ok) toast(tErr(result.error), "danger");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={t("actions", { name })}
          disabled={pending}
        >
          <MoreIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
          <ArrowUpIcon />
          {t("moveUp", { name })}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === order.length - 1} onSelect={() => move(1)}>
          <ArrowDownIcon />
          {t("moveDown", { name })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
