"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} aria-label={t("language")}>
          <Globe />
          {LOCALE_NAMES[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => startTransition(() => setLocale(value))}
        >
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {LOCALE_NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
