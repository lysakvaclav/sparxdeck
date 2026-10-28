"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { CrossIcon, LocateIcon, SortRouteIcon, ZoomToFitIcon } from "@/components/icons";
import { pointText } from "@/components/app/point-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import { captureScanLocation } from "@/lib/client/scan-location";
import type { ErrorCode } from "@/lib/errors";
import {
  ROUTE_MAX_STOPS,
  distanceParts,
  moveItem,
  orderRoute,
  routeDistance,
  routeLegs,
  type RouteOptions,
} from "@/lib/route-plans";
import type { RouteView } from "@/lib/route-plans-data";
import type { RouteStartKind } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import {
  addRouteStops,
  removeRouteStop,
  reorderRouteStops,
  setRouteOptions,
  setRouteStart,
  setStopVisited,
  updateRouteStop,
} from "../actions";
import { AddStopsDialog } from "./add-stops-dialog";
import { RouteMap, type RouteMapHandle } from "./route-map";
import { RouteStops } from "./route-stops";

const START_KINDS: RouteStartKind[] = ["company", "home", "here", "custom", "none"];

/**
 * A route's day of visits (part 23): the start point, the ordering, the stops
 * in their order and the map. Every change is saved at once; the order moves
 * on the page first and is put back if the server refuses it.
 */
export function RouteEditor({ route, today, soonDays }: { route: RouteView; today: string; soonDays: number }) {
  const t = useTranslations("routes");
  const tErr = useTranslations("errors");
  const tSite = useTranslations("sites.form");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const mapRef = useRef<RouteMapHandle>(null);
  const [pending, start] = useTransition();
  const [stops, setStops] = useState(route.stops);
  const [synced, setSynced] = useState(route.stops);
  const [selected, setSelected] = useState<string | null>(null);
  const [site, setSite] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [startKind, setStartKind] = useState(route.startKind);
  const [custom, setCustom] = useState(route.startKind === "custom" ? pointText(route.start) : "");
  const [customError, setCustomError] = useState<string>();
  const [locating, setLocating] = useState(false);

  // New data from the server (after a save or a refresh) replaces the page's copy.
  if (route.stops !== synced) {
    setSynced(route.stops);
    setStops(route.stops);
  }

  const options: RouteOptions = {
    returnToStart: route.returnToStart,
    lockFirst: route.lockFirst,
    lockLast: route.lockLast,
  };
  const points = stops.map((stop) => stop.point);
  const distanceText = (metres: number) => {
    const { value, unit } = distanceParts(metres);
    return t(`distance.${unit}`, { value: format.number(value) });
  };
  // Per stop: null without a point, "" for the first one when there is no start point.
  const legTexts = routeLegs(route.start, points).map((metres, index) => {
    if (!points[index]) return null;
    if (metres === null) return "";
    const first = !points.slice(0, index).some(Boolean);
    return t(first ? "stops.legFromStart" : "stops.leg", { distance: distanceText(metres) });
  });
  const total = routeDistance(route.start, points, route.returnToStart);
  const located = points.some(Boolean);
  const minutes = stops.reduce((sum, stop) => sum + (stop.minutes ?? 0), 0);
  const visited = stops.filter((stop) => stop.visitedAt).length;
  const inRoute = useMemo(() => new Set(stops.map((stop) => stop.siteId)), [stops]);
  const others = useMemo(
    () =>
      route.sites.flatMap((row) =>
        !inRoute.has(row.site_id) && row.latitude !== null && row.longitude !== null
          ? [{ id: row.site_id, point: { latitude: row.latitude, longitude: row.longitude } }]
          : [],
      ),
    [route.sites, inRoute],
  );
  const mapStops = useMemo(
    () => stops.map((stop, index) => ({ id: stop.id, number: index + 1, point: stop.point, visited: Boolean(stop.visitedAt) })),
    [stops],
  );
  const chosenSite = site ? route.sites.find((row) => row.site_id === site) : null;

  /** Runs a save; on a refusal says why and reloads what the server has. */
  const save = (action: () => Promise<{ ok: boolean; error?: ErrorCode }>, done?: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const result = await action();
        if (!result.ok) {
          toast(tErr(result.error ?? "unexpected"), "danger");
          setStops(route.stops);
          router.refresh();
          resolve(false);
          return;
        }
        if (done) toast(done, "success");
        router.refresh();
        resolve(true);
      }),
    );

  const reorder = (next: typeof stops, done?: string) => {
    setStops(next);
    void save(() => reorderRouteStops(route.id, next.map((stop) => stop.id)), done);
  };

  const sort = () => {
    const order = orderRoute(route.start, points, options);
    const next = order.map((index) => stops[index]!);
    const before = routeDistance(route.start, points, route.returnToStart);
    const after = routeDistance(route.start, next.map((stop) => stop.point), route.returnToStart);
    if (order.every((index, position) => index === position)) {
      toast(t("options.sortedSame"));
      return;
    }
    reorder(next, t("options.sorted", { before: distanceText(before), after: distanceText(after) }));
  };

  const chooseStart = async (kind: RouteStartKind) => {
    setStartKind(kind);
    setCustomError(undefined);
    if (kind === "custom") return;
    if (kind === "here") {
      setLocating(true);
      const capture = await captureScanLocation();
      setLocating(false);
      if ("error" in capture) {
        toast(tSite(`locateFailed.${capture.error}`), "danger");
        setStartKind(route.startKind);
        return;
      }
      void save(() => setRouteStart(route.id, { kind, coordinates: pointText(capture) }), t("start.saved"));
      return;
    }
    void save(() => setRouteStart(route.id, { kind }), t("start.saved"));
  };

  const startAvailable = (kind: RouteStartKind) =>
    kind === "company" ? route.company !== null : kind === "home" ? route.home !== null || route.startKind === "home" : true;

  const stopActions = {
    select: (id: string) => {
      setSelected((current) => (current === id ? null : id));
      const point = stops.find((stop) => stop.id === id)?.point;
      if (point) mapRef.current?.focus(point);
    },
    move: (from: number, to: number) => reorder(moveItem(stops, from, to)),
    shift: (id: string, step: -1 | 1) => {
      const from = stops.findIndex((stop) => stop.id === id);
      reorder(moveItem(stops, from, from + step));
    },
    setVisited: (id: string, value: boolean) => {
      setStops(stops.map((stop) => (stop.id === id ? { ...stop, visitedAt: value ? new Date().toISOString() : null } : stop)));
      void save(() => setStopVisited(id, value));
    },
    remove: (id: string) => {
      setStops(stops.filter((stop) => stop.id !== id));
      setSelected(null);
      void save(() => removeRouteStop(id), t("stops.removed"));
    },
    save: (id: string, values: { minutes: string; note: string }) =>
      save(() => updateRouteStop(id, values), t("stops.saved")),
  };

  const add = (ids: string[]) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const result = await addRouteStops(route.id, ids);
        if (!result.ok) {
          toast(tErr(result.error), "danger");
          resolve(false);
          return;
        }
        toast(t("add.added", { count: result.data.added }), "success");
        setSite(null);
        router.refresh();
        resolve(true);
      }),
    );

  const hours = Math.floor(minutes / 60);
  const onSite =
    hours > 0
      ? t("summary.hours", { hours, minutes: minutes % 60 })
      : t("summary.minutes", { minutes });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        className={cn(
          "flex min-h-0 flex-col border-border bg-background lg:w-[420px] lg:shrink-0 lg:border-e",
          view === "list" ? "flex-1" : "shrink-0",
        )}
      >
        <section aria-label={t("summary.label")} className="space-y-1 p-[15px] shadow-[inset_0_-1px_0_var(--border)]">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ui-lg font-semibold tabular-nums" data-total>
              {located ? t("summary.total", { distance: distanceText(total) }) : "—"}
            </span>
            <span className="text-ui-sm text-muted-foreground">{t("summary.totalHint")}</span>
          </p>
          <p className="text-ui-sm text-muted-foreground">
            {[
              t("summary.visited", { visited, count: stops.length }),
              minutes > 0 && t("summary.onSite", { time: onSite }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {!located && stops.length > 0 && <p className="text-ui-sm text-muted-foreground">{t("summary.noPoints")}</p>}
          {/* Phones: the stops or the map. */}
          <div role="tablist" className="mt-2 flex rounded-lg bg-canvas p-0.5 lg:hidden">
            {(["list", "map"] as const).map((value) => (
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
                {value === "list" ? t("map.viewList", { count: stops.length }) : t("map.viewMap")}
              </button>
            ))}
          </div>
        </section>

        <div className={cn("min-h-0 flex-1 scrollbar-thin overflow-y-auto", view === "map" && "hidden lg:block")}>
          <Alert className="m-[15px] mb-0">{t("straightLine")}</Alert>

          <section aria-labelledby="route-start-title" className="space-y-2.5 p-[15px]">
            <h2 id="route-start-title" className="text-ui font-semibold">
              {t("start.title")}
            </h2>
            <Field
              id="route-start-kind"
              label={t("start.label")}
              hint={
                startKind === "company" && !route.company
                  ? t("start.setCompany")
                  : startKind === "home" && !route.home
                    ? t("start.setHome")
                    : undefined
              }
            >
              <NativeSelect
                value={startKind}
                disabled={pending || locating}
                onChange={(event) => void chooseStart(event.target.value as RouteStartKind)}
              >
                {START_KINDS.map((kind) => (
                  <option key={kind} value={kind} disabled={!startAvailable(kind)}>
                    {t(`start.kind.${kind}`)}
                    {!startAvailable(kind) ? ` ${t("start.missing")}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {locating && (
              <p role="status" className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
                <LocateIcon /> {tSite("locating")}
              </p>
            )}
            {startKind === "custom" && (
              <form
                className="flex flex-wrap items-end gap-2"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  setCustomError(undefined);
                  void (async () => {
                    const result = await setRouteStart(route.id, { kind: "custom", coordinates: custom });
                    if (!result.ok) {
                      setCustomError(tErr(result.fieldErrors?.coordinates ?? result.error));
                      return;
                    }
                    toast(t("start.saved"), "success");
                    router.refresh();
                  })();
                }}
              >
                <Field id="route-start-point" label={t("start.coordinates")} error={customError} className="min-w-0 flex-1">
                  <Input
                    value={custom}
                    autoComplete="off"
                    placeholder="50.0755, 14.4378"
                    maxLength={100}
                    onChange={(event) => setCustom(event.target.value)}
                  />
                </Field>
                <Button type="submit" variant="outline" disabled={pending}>
                  {t("start.apply")}
                </Button>
              </form>
            )}
          </section>

          <section aria-labelledby="route-options-title" className="space-y-2 border-t border-border p-[15px]">
            <h2 id="route-options-title" className="text-ui font-semibold">
              {t("options.title")}
            </h2>
            {(["returnToStart", "lockFirst", "lockLast"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 text-ui pointer-coarse:min-h-11">
                <Checkbox
                  checked={options[key]}
                  disabled={pending || (key === "returnToStart" && !route.start)}
                  onCheckedChange={(value) =>
                    void save(() => setRouteOptions(route.id, { ...options, [key]: value === true }))
                  }
                />
                {t(`options.${key}`)}
              </label>
            ))}
            <div className="pt-1">
              <Button variant="outline" size="sm" disabled={pending || stops.length < 2} onClick={sort}>
                <SortRouteIcon />
                {t("options.sort")}
              </Button>
              <p className="mt-1 text-ui-sm text-muted-foreground">{t("options.sortHint")}</p>
              {points.some((point) => point === null) && (
                <p className="text-ui-sm text-muted-foreground">{t("options.unlocated")}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="route-stops-title" className="space-y-2.5 border-t border-border p-[15px]">
            <div className="flex items-center gap-2">
              <h2 id="route-stops-title" className="flex-1 text-ui font-semibold">
                {t("stops.title")}{" "}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {t("stops.count", { count: stops.length, max: ROUTE_MAX_STOPS })}
                </span>
              </h2>
              <AddStopsDialog
                sites={route.sites}
                inRoute={inRoute}
                left={ROUTE_MAX_STOPS - stops.length}
                max={ROUTE_MAX_STOPS}
                onAdd={add}
              />
            </div>
            {stops.length === 0 ? (
              <p className="text-ui text-muted-foreground">{t("stops.empty")}</p>
            ) : (
              <RouteStops
                stops={stops}
                legs={legTexts}
                selected={selected}
                today={today}
                soonDays={soonDays}
                disabled={pending}
                actions={stopActions}
              />
            )}
          </section>
        </div>
      </div>

      <div className={cn("relative min-h-0 flex-1", view === "list" && "hidden lg:block")}>
        <RouteMap
          ref={mapRef}
          start={route.start}
          stops={mapStops}
          others={others}
          returnToStart={route.returnToStart}
          selected={site}
          onSelectSite={setSite}
          onSelectStop={(id) => {
            setSelected(id);
            setView("list");
            document.querySelector(`[data-stop="${id}"]`)?.scrollIntoView({ block: "nearest" });
          }}
          label={t("map.label")}
          startLabel={t("map.start")}
        />
        <div className="absolute start-[15px] top-[15px] z-10">
          <Button variant="outline" size="sm" onClick={() => mapRef.current?.showAll()}>
            <ZoomToFitIcon />
            {t("map.showAll")}
          </Button>
        </div>
        {chosenSite && (
          <section
            aria-labelledby="route-site-title"
            className="absolute inset-x-[15px] bottom-[15px] z-10 space-y-2 rounded-lg bg-background p-[15px] shadow-elevation-3 sm:inset-x-auto sm:end-[15px] sm:bottom-auto sm:top-14 sm:w-80"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 id="route-site-title" className="text-ui-lg font-semibold">
                  {chosenSite.name}
                </h2>
                <p className="text-ui-sm text-muted-foreground">
                  {[chosenSite.address, chosenSite.customer_name].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button variant="ghost" size="iconSm" aria-label={t("map.close")} onClick={() => setSite(null)}>
                <CrossIcon />
              </Button>
            </div>
            <Button
              size="sm"
              disabled={pending || stops.length >= ROUTE_MAX_STOPS}
              onClick={() => void add([chosenSite.site_id])}
            >
              {t("map.add")}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
