"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { DocumentIcon, IssueIcon, SearchIcon, type IconComponent } from "@/components/icons";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { SEARCH_KINDS, type SearchHit, type SearchKind } from "@/lib/global-search";
import { cn } from "@/lib/utils";
import { globalSearch } from "@/app/(app)/search-actions";

const KIND_ICON: Record<SearchKind, { icon: IconComponent; tone: string }> = {
  customer: { icon: OBJECT_TYPES.customer.icon, tone: OBJECT_TYPES.customer.text },
  site: { icon: OBJECT_TYPES.site.icon, tone: OBJECT_TYPES.site.text },
  device: { icon: OBJECT_TYPES.device.icon, tone: OBJECT_TYPES.device.text },
  defect: { icon: IssueIcon, tone: appIcon("defects").tone },
  protocol: { icon: DocumentIcon, tone: appIcon("inspections").tone },
};

const OmnibarContext = createContext<(() => void) | null>(null);

/** Opens the search from anywhere in the app. */
export function useOmnibar() {
  const open = useContext(OmnibarContext);
  if (!open) throw new Error("useOmnibar outside OmnibarProvider");
  return open;
}

const noSubscribe = () => () => {};
/** "⌘K" on Apple devices, "Ctrl K" elsewhere (and on the server). */
function useShortcutLabel() {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );
}

/** The search dialog and its keyboard shortcuts: Ctrl/⌘ K, or "/" outside a text field. */
export function OmnibarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "");
      if (event.key === "/" && !typing && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OmnibarContext.Provider value={() => setOpen(true)}>
      {children}
      {open && <Omnibar onClose={() => setOpen(false)} />}
    </OmnibarContext.Provider>
  );
}

function Omnibar({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const ticket = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Results in the order they are shown, so the arrow keys follow the screen.
  const ordered = SEARCH_KINDS.flatMap((kind) => hits.filter((hit) => hit.kind === kind));

  function change(value: string) {
    setQuery(value);
    setActive(0);
    clearTimeout(timer.current);
    const id = ++ticket.current;
    if (!value.trim()) {
      setHits([]);
      setSearched("");
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const result = await globalSearch(value).catch(() => []);
      if (id !== ticket.current) return;
      setHits(result);
      setSearched(value.trim());
      setLoading(false);
    }, 180);
  }

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (ordered.length === 0) return;
      const next =
        (active + (event.key === "ArrowDown" ? 1 : -1) + ordered.length) % ordered.length;
      setActive(next);
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(ordered[active]);
    }
  }

  let index = -1;
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(15_23_42/0.5)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          aria-busy={loading}
          data-loading={loading ? "true" : "false"}
          className="fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[calc(100dvh-24px)] max-w-[640px] flex-col overflow-hidden rounded-xl bg-background shadow-elevation-4 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:top-[12vh] sm:max-h-[76vh]"
        >
          <DialogPrimitive.Title className="sr-only">{t("label")}</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center gap-2.5 px-5 shadow-[0_1px_0_var(--border)]">
            <SearchIcon size={20} className="text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-label={t("label")}
              aria-expanded={ordered.length > 0}
              aria-controls="omnibar-results"
              aria-activedescendant={ordered.length > 0 ? `omnibar-hit-${active}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("placeholder")}
              value={query}
              onChange={(event) => change(event.target.value)}
              onKeyDown={onKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent text-ui-lg outline-none placeholder:text-subtle"
            />
            {loading && <Spinner size={16} />}
          </div>

          <div className="min-h-0 scrollbar-thin overflow-y-auto">
            {ordered.length > 0 ? (
              <ul id="omnibar-results" role="listbox" ref={list} className="py-1.5">
                {SEARCH_KINDS.map((kind) => {
                  const group = ordered.filter((hit) => hit.kind === kind);
                  if (group.length === 0) return null;
                  const { icon: Icon, tone } = KIND_ICON[kind];
                  return (
                    <li key={kind} role="presentation">
                      <p className="px-5 pt-2 pb-1 text-ui-sm font-semibold text-muted-foreground">
                        {t(`groups.${kind}`)}
                      </p>
                      <ul role="presentation" className="px-2">
                        {group.map((hit) => {
                          index++;
                          const position = index;
                          return (
                            <li
                              key={`${hit.kind}-${hit.id}`}
                              id={`omnibar-hit-${position}`}
                              role="option"
                              aria-selected={position === active}
                              data-index={position}
                            >
                              <Link
                                href={hit.href}
                                tabIndex={-1}
                                onClick={(event) => {
                                  event.preventDefault();
                                  go(hit);
                                }}
                                onMouseMove={() => setActive(position)}
                                className={cn(
                                  "flex min-h-11 items-center gap-3 rounded-md px-3 py-1.5",
                                  position === active && "bg-primary text-white",
                                )}
                              >
                                <Icon className={cn("shrink-0", position !== active && tone)} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-ui">{hit.title}</span>
                                  {hit.subtitle && (
                                    <span
                                      className={cn(
                                        "block truncate text-ui-sm",
                                        position === active
                                          ? "text-white/80"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {hit.subtitle}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-5 text-ui text-muted-foreground" aria-live="polite">
                {searched && !loading ? t("empty", { query: searched }) : t("hint")}
              </p>
            )}
          </div>
          <p className="hidden shrink-0 px-5 py-1.5 text-ui-sm text-subtle shadow-[inset_0_1px_0_var(--border)] sm:block">
            {t("keys")}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The search entry in the desktop rail (icon, or the word and shortcut when expanded). */
export function RailSearchButton({ expanded }: { expanded: boolean }) {
  const t = useTranslations("nav");
  const open = useOmnibar();
  const shortcut = useShortcutLabel();
  const button = (
    <button
      type="button"
      onClick={open}
      aria-label={expanded ? undefined : `${t("search")} (${shortcut})`}
      aria-keyshortcuts="Control+K Meta+K /"
      className={
        expanded
          ? "mx-3 flex h-10 w-[calc(100%-24px)] items-center gap-3 rounded-lg bg-white/5 px-3 text-ui text-rail-foreground transition-colors hover:bg-rail-hover hover:text-white"
          : "mx-auto flex size-11 items-center justify-center rounded-lg text-rail-foreground transition-colors hover:bg-rail-hover hover:text-white"
      }
    >
      <SearchIcon size={20} />
      {expanded && (
        <>
          <span className="flex-1 truncate text-start">{t("search")}</span>
          <kbd className="rounded-sm bg-white/10 px-1.5 py-0.5 font-sans text-ui-xs text-rail-foreground">
            {shortcut}
          </kbd>
        </>
      )}
    </button>
  );
  return expanded ? (
    button
  ) : (
    <Tooltip label={`${t("search")} (${shortcut})`} side="right">
      {button}
    </Tooltip>
  );
}

/** The search button in the phone's top bar. */
export function MobileSearchButton() {
  const t = useTranslations("nav");
  const open = useOmnibar();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("search")}
      className="flex size-11 items-center justify-center rounded-lg text-rail-foreground hover:bg-rail-hover hover:text-white"
    >
      <SearchIcon size={20} />
    </button>
  );
}
