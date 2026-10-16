"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LogOutIcon, PersonIcon, ShareIcon } from "@/components/icons";
import { signOut } from "@/app/(auth)/actions";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { legalUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  name: string;
  email: string;
  /**
   * "rail": person icon with name and e-mail in the expanded desktop rail;
   * "railCompact": icon only in the collapsed rail; "compact": icon only in the
   * phone top bar.
   */
  variant?: "rail" | "railCompact" | "compact";
};

export function UserMenu({ name, email, variant = "rail" }: UserMenuProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("openMenu")}
        className={cn(
          "flex items-center gap-2.5 rounded-md text-start text-rail-foreground transition-colors outline-none hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
          variant === "rail" && "w-full px-[7px] py-1.5 hover:bg-rail-hover",
          variant === "railCompact" && "mx-auto size-[30px] justify-center hover:bg-rail-hover",
          variant === "compact" && "size-11 justify-center",
        )}
      >
        <PersonIcon />
        {variant === "rail" && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui text-white">{name}</span>
            <span className="block truncate text-ui-xs text-rail-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "compact" ? "end" : "start"}
        side={variant === "compact" ? "bottom" : variant === "rail" ? "top" : "right"}
        className="min-w-[220px]"
      >
        <div className="px-[7px] py-1.5">
          <p className="truncate text-ui font-semibold">{name}</p>
          <p className="truncate text-ui-sm text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <PersonIcon />
            {t("account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t("themeLight")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("themeDark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("themeSystem")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={legalUrl(locale, "privacy-policy")} target="_blank" rel="noreferrer">
            <ShareIcon />
            {tCommon("privacyPolicy")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={legalUrl(locale, "terms-of-use")} target="_blank" rel="noreferrer">
            <ShareIcon />
            {tCommon("terms")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOutIcon />
          {tAuth("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
