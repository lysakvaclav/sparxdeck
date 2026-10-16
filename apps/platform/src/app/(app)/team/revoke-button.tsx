"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "./actions";

/** Two-step revoke: the first tap asks for confirmation inline, the second revokes. */
export function RevokeButton({ invitationId }: { invitationId: string }) {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {t("revoke")}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="hidden text-ui-sm text-muted-foreground sm:inline">
        {t("revokeConfirm")}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        {tCommon("cancel")}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => void (await revokeInvitation(invitationId)))}
      >
        {t("revoke")}
      </Button>
    </div>
  );
}
