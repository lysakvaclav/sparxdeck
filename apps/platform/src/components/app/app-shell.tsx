"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MenuClosedIcon, MenuOpenIcon, MoreIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToastProvider } from "@/components/ui/toast";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, RAIL_COOKIE, isActive } from "./nav-items";
import { MobileSearchButton, OmnibarProvider, RailSearchButton } from "./omnibar";
import { TextLogo } from "./text-logo";
import { UserMenu } from "./user-menu";

const tabClass =
  "group relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors";
const tabActive = "text-link";
/** The icon's pill in the bottom bar: tinted for the current section. */
const tabPill =
  "flex h-7 w-14 items-center justify-center rounded-full transition-colors group-aria-[current=page]:bg-tint-primary group-data-[active]:bg-tint-primary";
const moreItems = NAV_ITEMS.filter((item) => item.phone === "more");

type AppShellProps = {
  organizationName: string;
  userName: string;
  userEmail: string;
  /** Desktop rail shows labels (remembered in a cookie). */
  railExpanded: boolean;
  children: React.ReactNode;
};

/**
 * Workspace frame: a dark navy navigation rail with plain icons (expandable to
 * show labels) and the page on the right, which brings its own header
 * (PageHeader) and scrolling body (PageBody). Phones get a dark top bar and a
 * white bottom tab bar. Logical properties keep right-to-left locales mirrored.
 */
export function AppShell({
  organizationName,
  userName,
  userEmail,
  railExpanded,
  children,
}: AppShellProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(railExpanded);

  function toggleRail() {
    const next = !expanded;
    setExpanded(next);
    document.cookie = `${RAIL_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const [home, ...apps] = NAV_ITEMS;

  const railItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, item);
    const Icon = item.icon;
    const link = (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={expanded ? undefined : t(item.label)}
        className={cn(
          "flex items-center rounded-lg transition-colors",
          expanded ? "mx-3 h-10 gap-3 px-3 text-ui font-medium" : "mx-auto size-11 justify-center",
          active
            ? "bg-rail-active text-white"
            : "text-rail-foreground hover:bg-rail-hover hover:text-white",
        )}
      >
        <Icon size={20} />
        {expanded && <span className="truncate">{t(item.label)}</span>}
      </Link>
    );
    return (
      <li key={item.href}>
        {expanded ? (
          link
        ) : (
          <Tooltip label={t(item.label)} side="right">
            {link}
          </Tooltip>
        )}
      </li>
    );
  };

  return (
    <TooltipProvider>
      <ToastProvider closeLabel={tCommon("close")}>
        <OmnibarProvider>
          <div className="flex h-dvh overflow-hidden bg-page">
            {/* Desktop rail */}
            <aside
              className={cn(
                "hidden shrink-0 flex-col bg-rail transition-[width] duration-150 lg:flex",
                expanded ? "w-60" : "w-16",
              )}
            >
              {/* The brand on top in both widths (the mark alone when collapsed). */}
              <div
                className={cn(
                  "flex h-16 shrink-0 items-center",
                  expanded ? "ps-6 pe-3" : "justify-center",
                )}
              >
                {expanded ? (
                  <div className="min-w-0">
                    <TextLogo label="SparxDeck" className="mb-1 h-[18px] text-white" />
                    <p
                      className="truncate text-ui-xs text-rail-foreground"
                      title={organizationName}
                    >
                      {organizationName}
                    </p>
                  </div>
                ) : (
                  <TextLogo label="SparxDeck" className="aspect-square h-6 text-white" />
                )}
              </div>

              <div className="pt-1 pb-2">
                <RailSearchButton expanded={expanded} />
              </div>
              <nav aria-label={t("mainNavigation")} className="flex-1 overflow-y-auto pb-3">
                <ul className="space-y-1">{home && railItem(home)}</ul>
                <div aria-hidden className="mx-4 my-3 h-px bg-white/10" />
                <ul className="space-y-1">{apps.map(railItem)}</ul>
              </nav>

              <div className={cn("shrink-0 pb-2", expanded ? "px-3" : "flex justify-center")}>
                <RailToggle
                  expanded={expanded}
                  label={expanded ? t("collapseRail") : t("expandRail")}
                  onClick={toggleRail}
                />
              </div>
              <div
                className={cn(
                  "shrink-0 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
                  expanded ? "px-3" : "flex justify-center",
                )}
              >
                <UserMenu
                  name={userName}
                  email={userEmail}
                  variant={expanded ? "rail" : "railCompact"}
                />
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Mobile top bar */}
              <header className="flex shrink-0 items-center justify-between gap-3 bg-rail ps-4 pe-2 pt-[env(safe-area-inset-top)] lg:hidden">
                <Link href="/" className="flex min-h-14 min-w-0 flex-col justify-center">
                  <TextLogo label="SparxDeck" className="mb-1 h-4 text-white" />
                  <span className="truncate text-ui-xs text-rail-foreground">
                    {organizationName}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <MobileSearchButton />
                  <UserMenu name={userName} email={userEmail} variant="compact" />
                </div>
              </header>

              <main className="flex min-h-0 flex-1 flex-col">{children}</main>

              {/* Mobile bottom navigation */}
              <nav
                aria-label={t("mainNavigation")}
                className="shrink-0 bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--border)] lg:hidden"
              >
                <ul className="mx-auto flex max-w-lg">
                  {NAV_ITEMS.filter((item) => item.phone === "tab").map(
                    ({ href, label, icon: Icon, also, match }) => {
                      const active = isActive(pathname, { href, also, match });
                      return (
                        <li key={href} className="flex-1">
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={cn(tabClass, active ? tabActive : "text-muted-foreground")}
                          >
                            <span className={tabPill}>
                              <Icon size={20} />
                            </span>
                            <span className="max-w-full truncate px-0.5">{t(label)}</span>
                          </Link>
                        </li>
                      );
                    },
                  )}
                  <li className="flex-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        data-active={
                          moreItems.some((item) => isActive(pathname, item)) ? "" : undefined
                        }
                        className={cn(
                          tabClass,
                          "w-full outline-none focus-visible:bg-accent",
                          moreItems.some((item) => isActive(pathname, item))
                            ? tabActive
                            : "text-muted-foreground",
                        )}
                      >
                        <span className={tabPill}>
                          <MoreIcon size={20} />
                        </span>
                        <span className="max-w-full truncate px-0.5">{t("more")}</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="end" className="min-w-52">
                        {moreItems.map((item) => (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              aria-current={isActive(pathname, item) ? "page" : undefined}
                              className="min-h-11"
                            >
                              <item.icon className={item.headerTone} />
                              {t(item.label)}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </OmnibarProvider>
      </ToastProvider>
    </TooltipProvider>
  );
}

function RailToggle({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = expanded ? MenuClosedIcon : MenuOpenIcon;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-rail-foreground transition-colors hover:bg-rail-hover hover:text-white"
    >
      <Icon />
    </button>
  );
  return (
    <Tooltip label={label} side="right">
      {button}
    </Tooltip>
  );
}
