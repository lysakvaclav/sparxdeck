"use client";

import { useTranslations } from "next-intl";
import { ShareIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Copies the address of the current page (with its selection) for a colleague. */
export function ShareButton() {
  const t = useTranslations("common");
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast(t("linkCopied"), "success");
        } catch {
          toast(t("copyFailed"));
        }
      }}
    >
      <ShareIcon />
      <span className="max-sm:sr-only">{t("share")}</span>
    </Button>
  );
}
