"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AddIcon, CalendarIcon, RouteIcon } from "@/components/icons";
import { OBJECT_TYPES } from "@/components/app/object-types";
import {
  PlanDialog,
  type PlanMember,
  type PlanSiteOption,
  type PlanValues,
} from "@/components/app/plan-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PlanState } from "@/lib/calendar";
import type { CalendarPlan, DueSite } from "@/lib/calendar-data";
import { calendarDate } from "@/lib/due";
import { cn } from "@/lib/utils";
import { StartInspectionButton } from "../inspections/start-button";

/** The device square that marks devices coming due. */
const DeviceMark = OBJECT_TYPES.device.icon;

/** Colour of a plan's dot: blue ahead, orange running, green done, red missed. */
const STATE_DOT: Record<PlanState, string> = {
  planned: "bg-primary",
  inProgress: "bg-warning",
  done: "bg-success",
  missed: "bg-destructive",
};
const STATE_BADGE: Record<PlanState, "primaryMinimal" | "warning" | "success" | "danger"> = {
  planned: "primaryMinimal",
  inProgress: "warning",
  done: "success",
  missed: "danger",
};

/** Plans and due dates of one month: a grid on wide screens, a list of days on phones. */
export function CalendarMonth({
  weeks,
  month,
  today,
  plans,
  due,
  members,
  sites,
  manager,
}: {
  weeks: string[][];
  month: string;
  today: string;
  plans: CalendarPlan[];
  due: Record<string, DueSite[]>;
  members: PlanMember[];
  sites: PlanSiteOption[];
  manager: boolean;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const [day, setDay] = useState<string | null>(null);
  const [planning, setPlanning] = useState<PlanValues | null>(null);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const plansByDay = useMemo(() => {
    const map: Record<string, CalendarPlan[]> = {};
    for (const plan of plans) (map[plan.plannedOn] ??= []).push(plan);
    return map;
  }, [plans]);
  const weekdays = weeks[0]!.map((date) =>
    format.dateTime(calendarDate(date), { weekday: "short", timeZone: "UTC" }),
  );
  const inMonth = (date: string) => date.startsWith(month);
  const dayLabel = (date: string) =>
    format.dateTime(calendarDate(date), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const deviceCount = (date: string) =>
    (due[date] ?? []).reduce((sum, site) => sum + site.devices, 0);
  const daysWithEvents = weeks
    .flat()
    .filter((date) => inMonth(date) && ((plansByDay[date]?.length ?? 0) > 0 || due[date]?.length));

  function plan(values: Partial<PlanValues>) {
    setPlanning({ siteId: "", plannedOn: day ?? today, technicianId: "", note: "", ...values });
  }

  const planPill = (item: CalendarPlan) => (
    <span className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATE_DOT[item.state])} />
      <span className="truncate">{item.siteName}</span>
      {item.routeId && <RouteIcon size={12} className="text-muted-foreground" title={t("day.inRoute")} />}
      <span className="sr-only">· {t(`state.${item.state}`)}</span>
    </span>
  );

  return (
    <>
      {/* Wide screens: the month grid. */}
      <div className="hidden md:block">
        <div
          role="grid"
          aria-label={format.dateTime(calendarDate(`${month}-01`), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          className="grid grid-cols-7 overflow-hidden rounded-md bg-card shadow-elevation-1"
        >
          <div role="row" className="contents">
            {weekdays.map((name) => (
              <div
                key={name}
                role="columnheader"
                className="bg-muted px-2 py-1.5 text-ui-sm font-semibold text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]"
              >
                {name}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div role="row" key={week[0]} className="contents">
              {week.map((date) => {
                const items = plansByDay[date] ?? [];
                const devices = deviceCount(date);
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    role="gridcell"
                    className={cn(
                      "min-h-28 min-w-0 shadow-[inset_-1px_-1px_0_var(--border)]",
                      !inMonth(date) && "bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setDay(date)}
                      aria-label={`${dayLabel(date)}: ${t("dayCounts", {
                        plans: items.length,
                        devices,
                      })}`}
                      data-day={date}
                      className="flex size-full flex-col gap-1 p-1.5 text-start transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]"
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-ui-sm tabular-nums",
                          isToday && "bg-primary font-semibold text-primary-foreground",
                          !isToday && !inMonth(date) && "text-subtle",
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      {items.slice(0, 3).map((item) => (
                        <span key={item.id} className="text-ui-sm">
                          {planPill(item)}
                        </span>
                      ))}
                      {items.length > 3 && (
                        <span className="text-ui-sm text-muted-foreground">
                          {t("more", { count: items.length - 3 })}
                        </span>
                      )}
                      {devices > 0 && (
                        <span className="mt-auto flex items-center gap-1 text-ui-sm text-muted-foreground">
                          <DeviceMark size={12} className={cn("shrink-0", OBJECT_TYPES.device.text)} />
                          {t("devicesDue", { count: devices })}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-muted-foreground">
          {(Object.keys(STATE_DOT) as PlanState[]).map((state) => (
            <li key={state} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", STATE_DOT[state])} />
              {t(`state.${state}`)}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <DeviceMark size={12} className={OBJECT_TYPES.device.text} />
            {t("legendDue")}
          </li>
        </ul>
      </div>

      {/* Phones: the days that have something, as a list. */}
      <div className="space-y-2.5 md:hidden">
        {daysWithEvents.length === 0 ? (
          <p className="rounded-md bg-card p-[15px] text-muted-foreground shadow-elevation-1">
            {t("emptyMonth")}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md bg-card shadow-elevation-1">
            {daysWithEvents.map((date) => {
              const items = plansByDay[date] ?? [];
              const devices = deviceCount(date);
              return (
                <li key={date} className="shadow-[inset_0_-1px_0_var(--border)] last:shadow-none">
                  <button
                    type="button"
                    onClick={() => setDay(date)}
                    data-day={date}
                    className="flex w-full flex-col gap-1 px-[15px] py-2.5 text-start hover:bg-accent pointer-coarse:min-h-11"
                  >
                    <span
                      className={cn(
                        "text-ui font-semibold first-letter:uppercase",
                        date === today && "text-link",
                      )}
                    >
                      {dayLabel(date)}
                      {date === today && ` · ${t("today")}`}
                    </span>
                    {items.map((item) => (
                      <span key={item.id} className="text-ui">
                        {planPill(item)}
                      </span>
                    ))}
                    {devices > 0 && (
                      <span className="flex items-center gap-1 text-ui-sm text-muted-foreground">
                        <DeviceMark size={12} className={OBJECT_TYPES.device.text} />
                        {t("devicesDue", { count: devices })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* One day: its visits and what comes due, with planning. */}
      <Dialog
        open={day !== null}
        onOpenChange={(open) => !open && setDay(null)}
        title={day ? dayLabel(day) : ""}
        icon={CalendarIcon}
        closeLabel={t("close")}
      >
        {day && (
          <div className="space-y-[15px]">
            <section className="space-y-2">
              <h3 className="text-ui font-semibold">{t("day.plans")}</h3>
              {(plansByDay[day] ?? []).length === 0 ? (
                <p className="text-ui text-muted-foreground">{t("day.noPlans")}</p>
              ) : (
                <ul className="space-y-2">
                  {(plansByDay[day] ?? []).map((item) => (
                    <li
                      key={item.id}
                      className="space-y-1.5 rounded-md p-2.5 shadow-[inset_0_0_0_1px_var(--border)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/sites/${item.siteId}`}
                          className="font-semibold text-link hover:underline"
                        >
                          {item.siteName}
                        </Link>
                        <Badge variant={STATE_BADGE[item.state]}>{t(`state.${item.state}`)}</Badge>
                      </div>
                      <p className="text-ui-sm text-muted-foreground">
                        {item.customerName} ·{" "}
                        {item.technicianId
                          ? (names.get(item.technicianId) ?? t("formerMember"))
                          : t("plan.unassigned")}
                      </p>
                      {item.note && (
                        <p className="text-ui break-words whitespace-pre-line">{item.note}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {item.inspectionId ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/inspections/${item.inspectionId}`}>
                              {t("day.openInspection")}
                            </Link>
                          </Button>
                        ) : (
                          <StartInspectionButton siteId={item.siteId} size="sm" />
                        )}
                        {item.routeId && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/routes/${item.routeId}`}>
                              <RouteIcon />
                              {t("day.openRoute")}
                            </Link>
                          </Button>
                        )}
                        {manager && !item.inspectionId && !item.routeId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPlanning({
                                id: item.id,
                                siteId: item.siteId,
                                plannedOn: item.plannedOn,
                                technicianId: item.technicianId ?? "",
                                note: item.note ?? "",
                              })
                            }
                          >
                            {t("day.edit")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-ui font-semibold">{t("day.due")}</h3>
              {(due[day] ?? []).length === 0 ? (
                <p className="text-ui text-muted-foreground">{t("day.noDue")}</p>
              ) : (
                <ul className="space-y-1">
                  {(due[day] ?? []).map((site) => (
                    <li
                      key={site.siteId}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <Link href={`/sites/${site.siteId}`} className="text-link hover:underline">
                          {site.siteName}
                        </Link>{" "}
                        <span className="text-ui-sm text-muted-foreground">
                          {site.customerName} · {t("devicesDue", { count: site.devices })}
                        </span>
                      </span>
                      {manager && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => plan({ siteId: site.siteId, plannedOn: day })}
                        >
                          <AddIcon />
                          {t("day.planThis")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {manager && (
              <div className="flex justify-end">
                <Button onClick={() => plan({ plannedOn: day })}>
                  <CalendarIcon />
                  {t("plan.title")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {planning && (
        <PlanDialog
          open
          onOpenChange={(open) => !open && setPlanning(null)}
          initial={planning}
          sites={sites}
          members={members}
        />
      )}
    </>
  );
}
