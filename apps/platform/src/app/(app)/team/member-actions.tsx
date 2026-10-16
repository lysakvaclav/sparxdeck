"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CrownIcon, DisableIcon, MoreIcon, ShieldIcon, WrenchIcon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ErrorCode } from "@/lib/errors";
import type { MemberRole } from "@/lib/supabase/database.types";
import { changeMemberRole, removeMember, transferOwnership } from "./actions";

type MemberActionsProps = {
  membershipId: string;
  name: string;
  role: MemberRole;
  /** The signed-in user is the owner (only the owner can transfer ownership). */
  viewerIsOwner: boolean;
};

type Pending = "remove" | "transfer" | null;

export function MemberActions({ membershipId, name, role, viewerIsOwner }: MemberActionsProps) {
  const t = useTranslations("memberActions");
  const tCommon = useTranslations("common");
  const tErr = useTranslations("errors");
  const [dialog, setDialog] = useState<Pending>(null);
  const [error, setError] = useState<ErrorCode>();
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof removeMember>, close = false) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (close) setDialog(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm" aria-label={t("menu", { name })} disabled={pending}>
            <MoreIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {role === "technician" ? (
            <DropdownMenuItem onSelect={() => run(() => changeMemberRole(membershipId, "admin"))}>
              <ShieldIcon />
              {t("makeAdmin")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => changeMemberRole(membershipId, "technician"))}
            >
              <WrenchIcon />
              {t("makeTechnician")}
            </DropdownMenuItem>
          )}
          {viewerIsOwner && (
            <DropdownMenuItem onSelect={() => setDialog("transfer")}>
              <CrownIcon />
              {t("transfer")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive-text [&_svg]:text-destructive-text"
            onSelect={() => setDialog("remove")}
          >
            <DisableIcon />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && !dialog && (
        <span role="alert" className="max-w-40 text-ui-sm text-destructive-text">
          {tErr(error)}
        </span>
      )}

      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("confirmRemoveTitle")}
        description={t("confirmRemoveBody", { name })}
        confirmLabel={t("remove")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={pending}
        onConfirm={() => run(() => removeMember(membershipId), true)}
      >
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "transfer"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("confirmTransferTitle")}
        description={t("confirmTransferBody", { name })}
        confirmLabel={t("transfer")}
        cancelLabel={tCommon("cancel")}
        pending={pending}
        onConfirm={() => run(() => transferOwnership(membershipId), true)}
      >
        {error && <Alert variant="error">{tErr(error)}</Alert>}
      </ConfirmDialog>
    </>
  );
}
