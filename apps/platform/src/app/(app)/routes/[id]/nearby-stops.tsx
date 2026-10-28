"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import {
  NEARBY_DEFAULT_RADIUS_M,
  distanceParts,
  nearbySuggestions,
} from "@/lib/route-plans";
import type { Coordinates } from "@/lib/scan-location";
import type { SiteMapRow } from "@/lib/site-map";
import { cn } from "@/lib/utils";

/** The radius each viewer chose last (a convenience; the default without storage). */
const RADIUS_KEY = "sparxdeck.routes.nearbyRadius";
const RADIUS_EVENT = "sparxdeck:nearby-radius";
const RADII = [1000, 3000, 5000, 10_000];
/** Shown at once; the rest is counted. */
const SHOWN = 8;

function readRadius(): number {
  try {
    const value = Number(localStorage.getItem(RADIUS_KEY));
    return RADII.includes(value) ? value : NEARBY_DEFAULT_RADIUS_M;
  } catch {
    return NEARBY_DEFAULT_RADIUS_M;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(RADIUS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RADIUS_EVENT, onChange);
  };
}

/**
 * "Due soon nearby" (part 23): the company's buildings near the route's stops
 * (straight line) that aren't in it and are due within 30 days or overdue,
 * soonest first, each added with one click.
 */
export function NearbyStops({
  stops,
  sites,
  inRoute,
  today,
  full,
  disabled,
  onAdd,
}: {
  stops: (Coordinates | null)[];
  sites: SiteMapRow[];
  inRoute: ReadonlySet<string>;
  today: string;
  /** The route has its 30 stops. */
  full: boolean;
  disabled: boolean;
  onAdd: (siteId: string) => void;
}) {
  const t = useTranslations("routes");
  const format = useFormatter();
  const radius = useSyncExternalStore(subscribe, readRadius, () => NEARBY_DEFAULT_RADIUS_M);
  const candidates = useMemo(
    () =>
      sites.flatMap((site) =>
        site.latitude !== null && site.longitude !== null
          ? [{ ...site, latitude: site.latitude, longitude: site.longitude }]
          : [],
      ),
    [sites],
  );
  const suggestions = useMemo(
    () => nearbySuggestions(stops, candidates, inRoute, today, radius),
    [stops, candidates, inRoute, today, radius],
  );
  const distance = (metres: number) => {
    const { value, unit } = distanceParts(metres);
    return t(`distance.${unit}`, { value: format.number(value) });
  };
  const located = stops.some(Boolean);

  return (
    <section aria-labelledby="route-nearby-title" className="space-y-2.5 border-t border-border p-[15px]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="route-nearby-title" className="flex-1 text-ui font-semibold">
          {t("nearby.title")}
        </h2>
        <label htmlFor="route-nearby-radius" className="text-ui-sm text-muted-foreground">
          {t("nearby.radius")}
        </label>
        <NativeSelect
          id="route-nearby-radius"
          className="w-28"
          value={String(radius)}
          onChange={(event) => {
            try {
              localStorage.setItem(RADIUS_KEY, event.target.value);
            } catch {
              // Not remembered; the default comes back next time.
            }
            window.dispatchEvent(new Event(RADIUS_EVENT));
          }}
        >
          {RADII.map((value) => (
            <option key={value} value={value}>
              {distance(value)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p className="text-ui-sm text-muted-foreground">{t("nearby.hint")}</p>
      {!located ? (
        <p className="text-ui text-muted-foreground">{t("nearby.noPoints")}</p>
      ) : suggestions.length === 0 ? (
        <p className="text-ui text-muted-foreground">{t("nearby.none", { distance: distance(radius) })}</p>
      ) : (
        <ul className="space-y-1.5" aria-label={t("nearby.title")}>
          {suggestions.slice(0, SHOWN).map(({ site, distance: metres, nearestStop }) => {
            const overdue = site.next_due! < today;
            return (
              <li
                key={site.site_id}
                data-nearby={site.site_id}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--border)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{site.name}</span>
                  <span className="block truncate text-ui-sm text-muted-foreground">{site.customer_name}</span>
                  <span className="flex flex-wrap gap-x-2 text-ui-sm">
                    <span className={cn(overdue ? "text-destructive-text" : "text-warning-text")}>
                      {t(overdue ? "stops.due.overdue" : "stops.due.soon", {
                        date: format.dateTime(calendarDate(site.next_due!), CALENDAR_FORMAT),
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      {t("nearby.near", { distance: distance(metres), number: nearestStop + 1 })}
                    </span>
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled || full}
                  aria-label={t("nearby.addName", { name: site.name })}
                  onClick={() => onAdd(site.site_id)}
                >
                  <AddIcon />
                  {t("nearby.add")}
                </Button>
              </li>
            );
          })}
          {suggestions.length > SHOWN && (
            <li className="text-ui-sm text-muted-foreground">{t("nearby.more", { count: suggestions.length - SHOWN })}</li>
          )}
        </ul>
      )}
    </section>
  );
}
