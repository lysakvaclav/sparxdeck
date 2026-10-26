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
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS, RAIL_COOKIE, isActive, type NavGroup } from "./nav-items";
import { MobileSearchButton, OmnibarProvider, RailSearchButton } from "./omnibar";
import { UserMenu } from "./user-menu";

const tabClass =
  "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10.5px] transition-colors";
const tabActive =
  "text-link before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-b-full before:bg-primary";
const moreItems = NAV_ITEMS.filter((item) => item.phone === "more");

/** Sidebar sections in order, with their headings (the first has none). */
const GROUPS: { group: NavGroup; heading?: "groupWork" | "groupRecords" | "groupAdmin" }[] = [
  { group: "main" },
  { group: "work", heading: "groupWork" },
  { group: "records", heading: "groupRecords" },
  { group: "admin", heading: "groupAdmin" },
];

type AppShellProps = {
  organizationName: string;
  userName: string;
  userEmail: string;
  /** Desktop rail shows labels (remembered in a cookie). */
  railExpanded: boolean;
  children: React.ReactNode;
};

/**
 * Workspace frame: a pale sidebar (company and fold button on top, search,
 * sections with headings, the account at the foot; folds to icons) and the page
 * on the right, which brings its own header (PageHeader) and scrolling body
 * (PageBody). Phones get a white top bar and a bottom tab bar. Logical
 * properties keep right-to-left locales mirrored.
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

  const railItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, item);
    const Icon = item.icon;
    const link = (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={expanded ? undefined : t(item.label)}
        className={cn(
          "flex h-[30px] items-center gap-2.5 rounded-md text-ui transition-colors",
          expanded ? "px-2" : "mx-auto w-[30px] justify-center",
          active
            ? "bg-rail-active font-medium text-foreground"
            : "text-rail-foreground hover:bg-rail-hover hover:text-foreground",
        )}
      >
        <Icon className={active ? "text-foreground" : "text-muted-foreground"} />
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
            {/* Desktop sidebar */}
            <aside
              className={cn(
                "hidden shrink-0 flex-col border-e border-border bg-rail transition-[width] duration-150 lg:flex",
                expanded ? "w-[248px]" : "w-[52px]",
              )}
            >
              {/* The company on top, with the button that folds the sidebar. */}
              <div
                className={cn(
                  "flex h-[50px] shrink-0 items-center gap-2",
                  expanded ? "ps-3 pe-2" : "justify-center",
                )}
              >
                {expanded && (
                  <>
                    <BrandMark label="SparxDeck" className="size-6" />
                    <span
                      className="min-w-0 flex-1 truncate text-ui font-semibold"
                      title={organizationName}
                    >
                      {organizationName}
                    </span>
                  </>
                )}
                <RailToggle
                  expanded={expanded}
                  label={expanded ? t("collapseRail") : t("expandRail")}
                  onClick={toggleRail}
                />
              </div>

              <div className={cn("pb-1", expanded ? "px-2" : "px-0")}>
                <RailSearchButton expanded={expanded} />
              </div>
              <nav
                aria-label={t("mainNavigation")}
                className={cn("flex-1 scrollbar-thin overflow-y-auto pb-3", expanded ? "px-2" : "px-0")}
              >
                {GROUPS.map(({ group, heading }) => (
                  <div key={group} className={heading ? "mt-3" : "mt-1"}>
                    {heading &&
                      (expanded ? (
                        <p className="px-2 pb-1 text-ui-sm font-medium text-muted-foreground">
                          {t(heading)}
                        </p>
                      ) : (
                        <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-border" />
                      ))}
                    <ul className="space-y-px">
                      {NAV_ITEMS.filter((item) => item.group === group).map(railItem)}
                    </ul>
                  </div>
                ))}
              </nav>

              <div
                className={cn(
                  "shrink-0 border-t border-border py-2",
                  expanded ? "px-2" : "flex justify-center",
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
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background ps-[15px] pe-1 pt-[env(safe-area-inset-top)] lg:hidden">
                <Link href="/" className="flex min-h-12 min-w-0 items-center gap-2">
                  <BrandMark label="SparxDeck" className="size-6" />
                  <span className="truncate text-ui font-semibold">{organizationName}</span>
                </Link>
                <div className="flex shrink-0 items-center">
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
                            <Icon size={20} />
                            <span className="max-w-full truncate px-0.5">{t(label)}</span>
                          </Link>
                        </li>
                      );
                    },
                  )}
                  <li className="flex-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          tabClass,
                          "w-full outline-none focus-visible:bg-accent",
                          moreItems.some((item) => isActive(pathname, item))
                            ? tabActive
                            : "text-muted-foreground",
                        )}
                      >
                        <MoreIcon size={20} />
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
      className="flex size-[30px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rail-hover hover:text-foreground"
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
