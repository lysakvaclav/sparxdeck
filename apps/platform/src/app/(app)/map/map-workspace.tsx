"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CrossIcon, MapMarkerIcon, ZoomToFitIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import {
  SITE_STATUSES,
  mapHref,
  sortSites,
  type MapFilters,
  type SiteMapRow,
  type SiteStatus,
} from "@/lib/site-map";
import { cn } from "@/lib/utils";
import { StartInspectionButton } from "../inspections/start-button";
import { STATUS_STYLE, SiteMapCanvas, type SiteMapHandle } from "./site-map-canvas";

/** The last filters, so the map opens as it was left (per phone, per company). */
const FILTERS_KEY = "sparxdeck.map.filters";

type Option = { id: string; name: string };

/**
 * The shape and colour of a state, with its words for screen readers; without
 * words (the text stands beside it) it is left out for them.
 */
function StatusMark({ status, label }: { status: SiteStatus; label: string }) {
  return (
    <span
      className="inline-flex w-4 shrink-0 justify-center text-base leading-none"
      style={{ color: STATUS_STYLE[status].color }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {STATUS_STYLE[status].glyph}
    </span>
  );
}

/**
 * The map of buildings with a traffic light (part 21): filters, a legend, the
 * list of buildings (the same data as the map, most urgent first; the way in
 * for keyboards and screen readers), the map, and the panel of the chosen
 * building. Buildings without a point wait in "without a location".
 */
export function MapWorkspace({
  organizationId,
  rows,
  filters,
  customers,
  types,
  technicians,
  manager,
}: {
  organizationId: string;
  rows: SiteMapRow[];
  filters: MapFilters;
  customers: Option[];
  types: Option[];
  technicians: Option[];
  manager: boolean;
}) {
  const t = useTranslations("siteMap");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const mapRef = useRef<SiteMapHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");

  const shown = useMemo(
    () => sortSites(rows, locale).filter((row) => !filters.status || row.status === filters.status),
    [rows, locale, filters.status],
  );
  // The same array until the rows change: the map fits its view to new rows,
  // and a fresh array on every selection would undo the zoom to a building.
  const located = useMemo(() => shown.filter((row) => row.latitude !== null), [shown]);
  const unlocated = shown.filter((row) => row.latitude === null);
  const current = shown.find((row) => row.site_id === selected) ?? null;
  const filtered = Object.values(filters).some(Boolean);
  const storageKey = `${FILTERS_KEY}.${organizationId}`;

  // Open as it was left: the remembered filters when the address has none.
  useEffect(() => {
    if (filtered) return;
    try {
      const remembered = localStorage.getItem(storageKey);
      if (remembered && remembered !== "/map") router.replace(remembered);
    } catch {
      // No storage: the map opens unfiltered.
    }
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key: keyof MapFilters, value: string) {
    const next = { ...filters, [key]: value || undefined };
    const href = mapHref(next);
    try {
      localStorage.setItem(storageKey, href);
    } catch {
      // Not remembered; the address still has it.
    }
    setSelected(null);
    router.push(href, { scroll: false });
  }

  function choose(siteId: string, fromList: boolean) {
    setSelected(siteId);
    if (fromList) {
      mapRef.current?.focus(siteId);
      setView("map");
    }
  }

  const summary = (row: SiteMapRow) =>
    [
      row.overdue && t("counts.overdue", { count: row.overdue }),
      row.soon && t("counts.soon", { count: row.soon }),
      row.never && t("counts.never", { count: row.never }),
      row.defects_critical && t("counts.critical", { count: row.defects_critical }),
      row.defects_major + row.defects_minor > 0 &&
        t("counts.defects", { count: row.defects_major + row.defects_minor }),
      row.devices === 0 && t("counts.noDevices"),
    ]
      .filter(Boolean)
      .join(" · ") || t("counts.fine");

  const select = (key: keyof MapFilters, label: string, all: string, options: Option[]) => (
    <div className="min-w-0 flex-1 basis-40">
      <label htmlFor={`map-${key}`} className="sr-only">
        {label}
      </label>
      <NativeSelect
        id={`map-${key}`}
        value={filters[key] ?? ""}
        onChange={(event) => setFilter(key, event.target.value)}
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  const row = (item: SiteMapRow) => (
    <li key={item.site_id}>
      <button
        type="button"
        onClick={() => choose(item.site_id, true)}
        aria-current={item.site_id === selected ? "true" : undefined}
        data-site={item.site_id}
        className={cn(
          "flex w-full items-start gap-2.5 px-[15px] py-2 text-start shadow-[inset_0_-1px_0_var(--border)] transition-colors hover:bg-accent pointer-coarse:min-h-14",
          item.site_id === selected && "bg-selected",
        )}
      >
        <span className="mt-0.5">
          <StatusMark status={item.status} label={t(`status.${item.status}`)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.name}</span>
          <span className="block truncate text-ui-sm text-muted-foreground">
            {item.customer_name}
          </span>
          <span className="block text-ui-sm text-muted-foreground">{summary(item)}</span>
        </span>
      </button>
    </li>
  );

  const panel = current && (
    <section
      aria-labelledby="map-panel-title"
      className="space-y-2.5 rounded-lg bg-background p-[15px] shadow-elevation-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="map-panel-title" className="text-ui-lg font-semibold">
            {current.name}
          </h2>
          <p className="text-ui-sm text-muted-foreground">
            {[current.address, current.customer_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={t("closePanel")}
          onClick={() => setSelected(null)}
        >
          <CrossIcon />
        </Button>
      </div>
      <p className="flex items-center gap-2 text-ui font-medium">
        <StatusMark status={current.status} label="" />
        {t(`status.${current.status}`)}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
        <dt className="text-muted-foreground">{t("panel.overdue")}</dt>
        <dd className="tabular-nums">{current.overdue}</dd>
        <dt className="text-muted-foreground">{t("panel.soon")}</dt>
        <dd className="tabular-nums">{current.soon}</dd>
        <dt className="text-muted-foreground">{t("panel.defects")}</dt>
        <dd className="tabular-nums">
          {current.defects_critical + current.defects_major + current.defects_minor}
          {current.defects_critical > 0 &&
            ` (${t("counts.critical", { count: current.defects_critical })})`}
        </dd>
        <dt className="text-muted-foreground">{t("panel.nextDue")}</dt>
        <dd>
          {current.next_due
            ? format.dateTime(calendarDate(current.next_due), CALENDAR_FORMAT)
            : "—"}
        </dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/sites/${current.site_id}`}>{t("panel.open")}</Link>
        </Button>
        {current.devices > 0 && (
          <StartInspectionButton siteId={current.site_id} size="sm" label={t("panel.start")} />
        )}
      </div>
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Filters, legend and the list (on phones: the list view). */}
      <div
        className={cn(
          "flex min-h-0 flex-col border-border bg-background lg:w-[360px] lg:shrink-0 lg:border-e",
          view === "list" ? "flex-1" : "shrink-0",
        )}
      >
        <div className="space-y-2.5 p-[15px] shadow-[inset_0_-1px_0_var(--border)]">
          <div className="flex flex-wrap gap-2">
            {select("customer", t("filters.customer"), t("filters.allCustomers"), customers)}
            {select("technician", t("filters.technician"), t("filters.allTechnicians"), technicians)}
            {select("type", t("filters.type"), t("filters.allTypes"), types)}
            <div className="min-w-0 flex-1 basis-40">
              <label htmlFor="map-status" className="sr-only">
                {t("filters.status")}
              </label>
              <NativeSelect
                id="map-status"
                value={filters.status ?? ""}
                onChange={(event) => setFilter("status", event.target.value)}
              >
                <option value="">{t("filters.allStatuses")}</option>
                {SITE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <ul aria-label={t("legend")} className="flex flex-wrap gap-x-3 gap-y-1 text-ui-sm">
            {SITE_STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <StatusMark status={status} label="" />
                <span>{t(`status.${status}`)}</span>
              </li>
            ))}
          </ul>
          {/* Phones: the map or the list. */}
          <div role="tablist" className="flex rounded-lg bg-canvas p-0.5 lg:hidden">
            {(["map", "list"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "min-h-11 flex-1 rounded-[5px] px-3 text-ui",
                  view === value
                    ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                    : "text-muted-foreground",
                )}
              >
                {t(value === "map" ? "viewMap" : "viewList", { count: shown.length })}
              </button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 scrollbar-thin overflow-y-auto",
            view === "map" && "hidden lg:block",
          )}
        >
          {rows.length === 0 ? (
            <p className="p-[15px] text-ui text-muted-foreground">
              {filtered ? t("emptyFiltered") : t("emptyNoSites")}
            </p>
          ) : (
            <>
              <h2 className="sr-only">{t("listTitle")}</h2>
              <ul aria-label={t("listTitle")}>{located.map(row)}</ul>
              {unlocated.length > 0 && (
                <section aria-labelledby="map-unlocated" className="mt-2">
                  <h2
                    id="map-unlocated"
                    className="flex items-center gap-1.5 px-[15px] pt-2 pb-1 text-ui-sm font-semibold text-muted-foreground"
                  >
                    <MapMarkerIcon />
                    {t("unlocated", { count: unlocated.length })}
                  </h2>
                  <p className="px-[15px] pb-1 text-ui-sm text-muted-foreground">
                    {t("unlocatedHint")}
                  </p>
                  <ul>
                    {unlocated.map((item) => (
                      <li
                        key={item.site_id}
                        className="flex items-center gap-2.5 px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)]"
                      >
                        <StatusMark status={item.status} label={t(`status.${item.status}`)} />
                        <span className="min-w-0 flex-1">
                          <Link
                            href={`/sites/${item.site_id}`}
                            className="block truncate font-medium text-link hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="block truncate text-ui-sm text-muted-foreground">
                            {summary(item)}
                          </span>
                        </span>
                        {manager && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/sites/${item.site_id}/edit`}>{t("addPoint")}</Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* The map, with the chosen building's panel over it. */}
      <div
        className={cn(
          "relative min-h-0 flex-1",
          view === "list" && "hidden lg:block",
        )}
      >
        {located.length === 0 && rows.length > 0 && (
          <p className="absolute inset-x-[15px] top-[15px] z-10 rounded-lg bg-background p-[15px] text-ui shadow-elevation-2">
            {t("emptyNoPoints")}
          </p>
        )}
        <SiteMapCanvas
          ref={mapRef}
          rows={located}
          selected={selected}
          onSelect={(id) => choose(id, false)}
          label={t("mapLabel")}
        />
        <div className="absolute start-[15px] top-[15px] z-10">
          <Button variant="outline" size="sm" onClick={() => mapRef.current?.showAll()}>
            <ZoomToFitIcon />
            {t("showAll")}
          </Button>
        </div>
        {panel && (
          <div className="absolute inset-x-[15px] bottom-[15px] z-10 sm:inset-x-auto sm:end-[15px] sm:bottom-auto sm:top-14 sm:w-80">
            {panel}
          </div>
        )}
      </div>
    </div>
  );
}
