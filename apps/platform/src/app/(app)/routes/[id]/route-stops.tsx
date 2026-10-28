"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DragHandleVerticalIcon,
  NavigationIcon,
  TrashIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CALENDAR_FORMAT, calendarDate, dueState } from "@/lib/due";
import type { RouteStopView } from "@/lib/route-plans-data";
import { mapAppHref } from "@/lib/route-plans";
import { cn } from "@/lib/utils";
import { StartInspectionButton } from "../../inspections/start-button";

// The stops of a route in their order (part 23). They move by dragging, by
// keyboard (space picks one up, arrows move it, space puts it down; the steps
// are announced) and by the up and down buttons of the chosen stop.

export type StopActions = {
  select: (id: string) => void;
  move: (from: number, to: number) => void;
  shift: (id: string, step: -1 | 1) => void;
  setVisited: (id: string, visited: boolean) => void;
  remove: (id: string) => void;
  save: (id: string, values: { minutes: string; note: string }) => Promise<boolean>;
};

const noSubscribe = () => () => {};

function StopRow({
  stop,
  index,
  count,
  selected,
  leg,
  today,
  soonDays,
  disabled,
  actions,
}: {
  stop: RouteStopView;
  index: number;
  count: number;
  selected: boolean;
  /** Text of the distance to it, null without a point. */
  leg: string | null;
  today: string;
  soonDays: number;
  disabled: boolean;
  actions: StopActions;
}) {
  const t = useTranslations("routes.stops");
  const format = useFormatter();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id, disabled });
  // The link to the map application depends on the phone; the server renders none.
  const userAgent = useSyncExternalStore(noSubscribe, () => navigator.userAgent, () => "");
  const [minutes, setMinutes] = useState(stop.minutes?.toString() ?? "");
  const [note, setNote] = useState(stop.note ?? "");
  const [saving, setSaving] = useState(false);
  const due = stop.nextDue ? dueState(stop.nextDue, today, soonDays) : "never";
  const dueText =
    stop.nextDue === null
      ? t(stop.devices > 0 ? "due.never" : "due.noDevices")
      : t(`due.${due === "overdue" ? "overdue" : due === "soon" ? "soon" : "later"}`, {
          date: format.dateTime(calendarDate(stop.nextDue), CALENDAR_FORMAT),
        });
  const visited = Boolean(stop.visitedAt);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-stop={stop.id}
      className={cn(
        "relative rounded-lg bg-background shadow-[inset_0_0_0_1px_var(--border)]",
        selected && "shadow-[inset_0_0_0_2px_var(--ring)]",
        isDragging && "z-10 shadow-elevation-3",
      )}
    >
      <div className="flex items-stretch gap-0.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("drag", { name: stop.name })}
          className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-s-lg text-muted-foreground outline-none hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] active:cursor-grabbing disabled:cursor-default pointer-coarse:w-11"
        >
          <DragHandleVerticalIcon />
        </button>
        <span
          aria-hidden="true"
          className={cn(
            "mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full text-ui-sm font-bold tabular-nums",
            visited ? "bg-[#0f7246] text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {index + 1}
        </span>
        <button
          type="button"
          onClick={() => actions.select(stop.id)}
          aria-expanded={selected}
          aria-label={t("show", { name: stop.name })}
          data-select
          className="min-w-0 flex-1 py-2 ps-2 text-start outline-none focus-visible:underline"
        >
          <span className={cn("block truncate font-medium", visited && "text-muted-foreground line-through")}>
            {stop.name}
          </span>
          <span className="block truncate text-ui-sm text-muted-foreground">
            {[stop.customerName, stop.address].filter(Boolean).join(" · ")}
          </span>
          <span className="flex flex-wrap gap-x-2 text-ui-sm">
            <span
              className={cn(
                due === "overdue" ? "text-destructive-text" : due === "soon" ? "text-warning-text" : "text-muted-foreground",
              )}
            >
              {dueText}
            </span>
            <span className="text-muted-foreground">{leg ?? t("noPoint")}</span>
          </span>
        </button>
        <label className="flex shrink-0 items-center gap-1.5 pe-2.5 text-ui-sm text-muted-foreground pointer-coarse:pe-3.5">
          <Checkbox
            checked={visited}
            disabled={disabled}
            aria-label={t("visitedName", { name: stop.name })}
            onCheckedChange={(value) => actions.setVisited(stop.id, value === true)}
          />
          <span className="hidden sm:inline">{t("visited")}</span>
        </label>
      </div>
      {selected && (
        <div className="space-y-2.5 border-t border-border px-2.5 py-2.5">
          <div className="flex flex-wrap gap-2">
            {stop.devices > 0 && <StartInspectionButton siteId={stop.siteId} size="sm" label={t("start")} />}
            {stop.point && userAgent && (
              <Button asChild variant="outline" size="sm">
                <a href={mapAppHref(stop.point, userAgent)} target="_blank" rel="noopener noreferrer">
                  <NavigationIcon />
                  {t("openMap")}
                </a>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/sites/${stop.siteId}`}>{stop.name}</Link>
            </Button>
          </div>
          <form
            className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2.5"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              await actions.save(stop.id, { minutes, note });
              setSaving(false);
            }}
          >
            <Field id={`stop-minutes-${stop.id}`} label={t("minutes")}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={720}
                value={minutes}
                disabled={disabled}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </Field>
            <Field id={`stop-note-${stop.id}`} label={t("note")}>
              <Textarea
                rows={1}
                maxLength={500}
                value={note}
                disabled={disabled}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <div className="col-span-2 flex flex-wrap items-center gap-1">
              <Button type="submit" size="sm" variant="outline" disabled={disabled || saving}>
                {t("save")}
              </Button>
              <span className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("moveUp", { name: stop.name })}
                disabled={disabled || index === 0}
                onClick={() => actions.shift(stop.id, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("moveDown", { name: stop.name })}
                disabled={disabled || index === count - 1}
                onClick={() => actions.shift(stop.id, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("remove", { name: stop.name })}
                disabled={disabled}
                onClick={() => actions.remove(stop.id)}
              >
                <TrashIcon />
              </Button>
            </div>
          </form>
        </div>
      )}
    </li>
  );
}

export function RouteStops({
  stops,
  legs,
  selected,
  today,
  soonDays,
  disabled,
  actions,
}: {
  stops: RouteStopView[];
  /** Per stop, the text of its distance from the previous point (null without a point). */
  legs: (string | null)[];
  selected: string | null;
  today: string;
  soonDays: number;
  /** While a change is being saved. */
  disabled: boolean;
  actions: StopActions;
}) {
  const t = useTranslations("routes.stops");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (id: string | number) => stops.findIndex((stop) => stop.id === id) + 1;
  const nameOf = (id: string | number) => stops.find((stop) => stop.id === id)?.name ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("dragStart", { name: nameOf(active.id), position: position(active.id), count: stops.length }),
    onDragOver: ({ active, over }) =>
      over ? t("dragOver", { name: nameOf(active.id), position: position(over.id), count: stops.length }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("dragEnd", { name: nameOf(active.id), position: position(over.id), count: stops.length })
        : t("dragCancel", { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t("dragCancel", { name: nameOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    actions.move(position(active.id) - 1, position(over.id) - 1);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("dragInstructions") } }}
    >
      <SortableContext items={stops.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-1.5" aria-label={t("label")}>
          {stops.map((stop, index) => (
            <StopRow
              key={stop.id}
              stop={stop}
              index={index}
              count={stops.length}
              selected={stop.id === selected}
              leg={legs[index] ?? null}
              today={today}
              soonDays={soonDays}
              disabled={disabled}
              actions={actions}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
