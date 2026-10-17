"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DisableIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CheckSkipReason } from "@/lib/supabase/database.types";
import { CHECK_SKIP_REASONS } from "@/lib/validation";
import { cn } from "@/lib/utils";

/**
 * "Can't check": why the device is left out (inaccessible, missing) and an
 * optional note for the office and the protocol.
 */
export function SkipDialog({
  open,
  onOpenChange,
  pending,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSkip: (reason: CheckSkipReason, note: string) => void;
}) {
  const t = useTranslations("inspections.skip");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState<CheckSkipReason | null>(null);
  const [note, setNote] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={t("title")}
      icon={DisableIcon}
      closeLabel={tCommon("close")}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (reason) onSkip(reason, note);
        }}
      >
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {CHECK_SKIP_REASONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => setReason(value)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-md px-3 py-2 text-start shadow-[inset_0_0_0_1px_var(--border)] hover:bg-[var(--btn-bg-hover)]",
                reason === value && "bg-primary/10 shadow-[inset_0_0_0_2px_var(--ring)]",
              )}
            >
              <span className="text-ui-lg font-medium">{t(`reasons.${value}`)}</span>
              <span className="text-ui-sm text-muted-foreground">{t(`hints.${value}`)}</span>
            </button>
          ))}
        </div>
        <Field id="skip-note" label={t("note")}>
          <Textarea
            rows={2}
            maxLength={2000}
            autoCapitalize="sentences"
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <p className="text-ui-sm text-muted-foreground">{t("termHint")}</p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={!reason || pending}>
            {pending && <Spinner size={16} />}
            {t("submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
