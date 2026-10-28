"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { NavigationIcon, RouteIcon, TickIcon, WarningSignIcon } from "@/components/icons";
import { EmptyState } from "@/components/app/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { keepPage, keepStaticFiles } from "@/lib/client/keep-page";
import { rememberOwner } from "@/lib/client/offline-store";
import {
  readVisitQueue,
  sendVisitQueue,
  serverVisitQueue,
  subscribeVisitQueue,
  writeVisitQueue,
} from "@/lib/client/route-visits";
import { calendarDate, todayInTimeZone } from "@/lib/due";
import { distanceParts, mapAppHref, routeDistance } from "@/lib/route-plans";
import type { TodayRoute } from "@/lib/route-plans-data";
import { markVisit, withMarks } from "@/lib/route-visits";
import { cn } from "@/lib/utils";
import { StartInspectionButton } from "../../inspections/start-button";

const PAGE = "/routes/today";
const noSubscribe = () => () => {};

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Today's stops on the phone (part 23). A mark "visited" shows at once, waits
 * in the phone and is sent with the time it was made, now or once there is a
 * signal again. The page itself is kept in the phone for the day.
 */
export function TodayPlan({
  routes,
  day,
  timeZone,
  userId,
}: {
  routes: TodayRoute[];
  /** The day the server rendered the plan for. */
  day: string;
  timeZone: string;
  userId: string;
}) {
  const t = useTranslations("routes");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const queue = useSyncExternalStore(subscribeVisitQueue, readVisitQueue, serverVisitQueue);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const userAgent = useSyncExternalStore(noSubscribe, () => navigator.userAgent, () => "");
  // A copy kept from an earlier day, opened without a signal.
  const deviceToday = useSyncExternalStore(noSubscribe, () => todayInTimeZone(timeZone), () => day);
  const [sending, setSending] = useState(false);
  const waiting = Object.keys(queue).length;

  const send = useCallback(async () => {
    if (!navigator.onLine || !Object.keys(readVisitQueue()).length) return;
    setSending(true);
    const result = await sendVisitQueue();
    setSending(false);
    if (result.dropped) toast(t("today.dropped", { count: result.dropped }), "danger");
    if (result.sent || result.dropped) router.refresh();
  }, [router, t, toast]);

  // Keep the page for the day; send what waits now and whenever the signal returns.
  useEffect(() => {
    rememberOwner(userId);
    if (navigator.onLine) {
      void keepPage(PAGE).catch(() => undefined);
      void keepStaticFiles().catch(() => undefined);
    }
    const timer = setTimeout(send, 0);
    window.addEventListener("online", send);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", send);
    };
  }, [send, userId]);

  const shown = useMemo(
    () => routes.map((route) => ({ ...route, stops: withMarks(route.stops, queue) })),
    [routes, queue],
  );

  const toggle = (stop: { id: string; visitedAt: string | null }, serverVisited: boolean) => {
    writeVisitQueue(markVisit(readVisitQueue(), stop.id, !stop.visitedAt, new Date().toISOString(), serverVisited));
    void send();
  };

  const distance = (metres: number) => {
    const { value, unit } = distanceParts(metres);
    return t(`distance.${unit}`, { value: format.number(value) });
  };
  const dayText = (date: string) =>
    format.dateTime(calendarDate(date), { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-2.5 sm:space-y-[15px]">
      <p className="text-ui-lg font-semibold first-letter:uppercase">{dayText(day)}</p>
      {deviceToday !== day && (
        <Alert variant="warning" icon={WarningSignIcon}>
          {t("today.stale", { day: dayText(day) })}
        </Alert>
      )}
      {(!online || waiting > 0) && (
        <Alert variant={online ? "info" : "warning"}>
          <span data-waiting={waiting}>
            {!online && t("today.offline")} {waiting > 0 && t(sending ? "today.sending" : "today.waiting", { count: waiting })}
          </span>
        </Alert>
      )}
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={RouteIcon} title={t("today.empty")} />
          <div className="flex justify-center pb-[15px]">
            <Button asChild variant="outline">
              <Link href="/routes">{t("today.allRoutes")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        shown.map((route) => {
          const visited = route.stops.filter((stop) => stop.visitedAt).length;
          const points = route.stops.map((stop) => stop.point);
          return (
            <Card key={route.id} data-route={route.id}>
              <CardHeader>
                <CardTitle>{route.name || t("untitled")}</CardTitle>
                <p className="text-ui-sm text-muted-foreground">
                  {[
                    t("summary.visited", { visited, count: route.stops.length }),
                    points.some(Boolean) &&
                      `${t("summary.total", { distance: distance(routeDistance(route.start, points, route.returnToStart)) })} ${t("summary.totalHint")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </CardHeader>
              <ol className="divide-y divide-border">
                {route.stops.map((stop, index) => {
                  const done = Boolean(stop.visitedAt);
                  const serverVisited = Boolean(routes.find((r) => r.id === route.id)?.stops[index]?.visitedAt);
                  return (
                    <li key={stop.id} data-stop={stop.id} className="space-y-2 px-[15px] py-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-ui font-bold tabular-nums",
                            done ? "bg-[#0f7246] text-white" : "bg-primary text-primary-foreground",
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-semibold", done && "text-muted-foreground line-through")}>{stop.name}</p>
                          <p className="text-ui-sm text-muted-foreground">
                            {[stop.customerName, stop.address].filter(Boolean).join(" · ")}
                          </p>
                          {(stop.note || stop.minutes) && (
                            <p className="text-ui-sm">
                              {[stop.minutes ? t("summary.minutes", { minutes: stop.minutes }) : null, stop.note]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {stop.waiting && <p className="text-ui-sm text-warning-text">{t("today.stopWaiting")}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 ps-[38px]">
                        <Button
                          size="sm"
                          variant={done ? "outline" : "primary"}
                          aria-pressed={done}
                          aria-label={t("stops.visitedName", { name: stop.name })}
                          className="pointer-coarse:min-h-11"
                          onClick={() => toggle(stop, serverVisited)}
                        >
                          <TickIcon />
                          {done ? t("today.visited") : t("today.markVisited")}
                        </Button>
                        {stop.point && userAgent && (
                          <Button asChild size="sm" variant="outline" className="pointer-coarse:min-h-11">
                            <a href={mapAppHref(stop.point, userAgent)} target="_blank" rel="noopener noreferrer">
                              <NavigationIcon />
                              {t("stops.openMap")}
                            </a>
                          </Button>
                        )}
                        {online && stop.devices > 0 && !done && (
                          <StartInspectionButton
                            siteId={stop.siteId}
                            size="sm"
                            variant="outline"
                            label={t("stops.start")}
                            className="pointer-coarse:min-h-11"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {online && (
                <div className="border-t border-border px-[15px] py-2.5">
                  <Link href={`/routes/${route.id}`} className="touch-link text-ui text-link hover:underline">
                    {t("today.edit")}
                  </Link>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
