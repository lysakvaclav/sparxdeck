"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** The language as one small pill with a segment per language (the sign-in screens). */
export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="inline-flex rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            title={LOCALE_NAMES[code]}
            aria-label={LOCALE_NAMES[code]}
            aria-pressed={active}
            disabled={pending}
            onClick={() => !active && startTransition(() => setLocale(code))}
            className={cn(
              "min-w-10 rounded-full px-3 text-xs font-medium tracking-wide uppercase transition-colors h-8 pointer-coarse:h-10 pointer-coarse:min-w-11",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
