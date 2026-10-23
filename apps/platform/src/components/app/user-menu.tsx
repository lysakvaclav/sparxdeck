"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LogOutIcon, PersonIcon, ShareIcon } from "@/components/icons";
import { signOut } from "@/app/(auth)/actions";
import { setLocale } from "@/i18n/actions";
import { pendingInPhone, wipeOfflineData } from "@/lib/client/offline-store";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { legalUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
   * "rail": avatar with name and e-mail in the expanded desktop rail;
   * "railCompact": avatar only in the collapsed rail; "compact": avatar only in
   * the phone top bar.
   */
  variant?: "rail" | "railCompact" | "compact";
};

export function UserMenu({ name, email, variant = "rail" }: UserMenuProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [signingOut, startTransition] = useTransition();
  // Unsent changes from inspections in this phone: signing out deletes them.
  const [waiting, setWaiting] = useState(0);

  function leave() {
    startTransition(async () => {
      // What the inspections left in the phone goes with the account.
      await wipeOfflineData();
      await signOut();
    });
  }

  async function requestSignOut() {
    const count = await pendingInPhone().catch(() => 0);
    if (count > 0) setWaiting(count);
    else leave();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("openMenu")}
          className={cn(
            "flex items-center gap-3 rounded-lg text-start text-rail-foreground transition-colors outline-none hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
            variant === "rail" && "w-full px-2 py-1.5 hover:bg-rail-hover",
            variant === "railCompact" && "size-11 justify-center hover:bg-rail-hover",
            variant === "compact" && "size-11 justify-center",
          )}
        >
          <Avatar name={name} size={variant === "rail" ? 34 : 32} />
          {variant === "rail" && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium text-white">{name}</span>
              <span className="block truncate text-ui-xs text-rail-foreground">{email}</span>
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "compact" ? "end" : "start"}
          side={variant === "compact" ? "bottom" : variant === "rail" ? "top" : "right"}
          className="min-w-[220px]"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-ui font-semibold">{name}</p>
              <p className="truncate text-ui-sm text-muted-foreground">{email}</p>
            </div>
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
          <DropdownMenuItem onSelect={() => void requestSignOut()}>
            <LogOutIcon />
            {tAuth("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={waiting > 0}
        onOpenChange={(open) => !open && !signingOut && setWaiting(0)}
        title={tAuth("signOutPending.title")}
        description={tAuth("signOutPending.body", { count: waiting })}
        confirmLabel={tAuth("signOutPending.confirm")}
        cancelLabel={tCommon("cancel")}
        destructive
        pending={signingOut}
        onConfirm={leave}
      />
    </>
  );
}
