"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  CrossIcon,
  EditIcon,
  MapMarkerIcon,
  PinIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/icons";
import { DUE_BADGE } from "@/components/app/device-badges";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { DUE_TONE } from "@/components/app/plan-tones";
import {
  PlanLegend,
  PlanViewer,
  type PlanMarker,
  type PlanViewerHandle,
} from "@/components/app/plan-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { labelQuery } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate, type DueState } from "@/lib/due";
import type { PlanDevice } from "@/lib/floor-plans-data";
import type { Point } from "@/lib/floor-plans";
import { cn } from "@/lib/utils";
import { placeDevice, removePlacement } from "../../../plan-actions";

type Placement = PlanDevice["placement"];
type Plan = {
  id: string;
  name: string;
  width: number;
  height: number;
  imageUrl: string | null;
  locationId: string | null;
};

/** Saves of a dragged or nudged marker wait this long for the next move. */
const SAVE_DELAY = 450;

/**
 * A floor plan with the building's devices: the plan, and beside it (below on a
 * phone) the devices on this plan, on other plans and not placed yet. Owners
 * and admins place devices (pick one, tap the plan), move them (drag, arrow
 * keys) and take them off. Changes show at once and are saved in the background.
 */
export function PlanWorkspace({
  plan,
  plans,
  devices: initial,
  editable,
  placeId,
}: {
  plan: Plan;
  plans: { id: string; name: string }[];
  devices: PlanDevice[];
  editable: boolean;
  /** Start placing this device (from "Place on floor plan" on its page). */
  placeId: string | null;
}) {
  const t = useTranslations("plans");
  const tErr = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const viewer = useRef<PlanViewerHandle>(null);
  const [spots, setSpots] = useState(
    () => new Map(initial.map((device) => [device.id, device.placement])),
  );
  const saved = useRef(new Map(initial.map((device) => [device.id, device.placement])));
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, Placement>());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(() =>
    editable && placeId && initial.some((device) => device.id === placeId) ? placeId : null,
  );
  const [query, setQuery] = useState("");

  // Moves still waiting when the page closes are sent right away.
  useEffect(() => {
    const waiting = timers.current;
    const unsent = pending.current;
    return () => {
      waiting.forEach((timer) => window.clearTimeout(timer));
      unsent.forEach(
        (placement, id) =>
          void (placement
            ? placeDevice({
                planId: placement.planId,
                deviceId: id,
                x: placement.x,
                y: placement.y,
              })
            : removePlacement(id)),
      );
    };
  }, []);

  const planName = new Map(plans.map((item) => [item.id, item.name]));
  const devices = initial.map((device) => ({ ...device, placement: spots.get(device.id) ?? null }));
  const byId = new Map(devices.map((device) => [device.id, device]));
  const number = labelQuery(query);
  const matches = (device: PlanDevice) =>
    !query.trim() || (number !== null && String(device.labelNumber).startsWith(String(number)));

  const onPlan = devices.filter((device) => device.placement?.planId === plan.id);
  const elsewhere = devices.filter(
    (device) => device.placement && device.placement.planId !== plan.id,
  );
  // Devices of the plan's floor first.
  const unplaced = devices
    .filter((device) => !device.placement)
    .sort(
      (a, b) =>
        Number(b.locationId === plan.locationId && !!plan.locationId) -
          Number(a.locationId === plan.locationId && !!plan.locationId) ||
        a.labelNumber - b.labelNumber,
    );

  const markers: PlanMarker[] = onPlan.map((device) => ({
    id: device.id,
    x: device.placement!.x,
    y: device.placement!.y,
    label: device.number,
    tone: DUE_TONE[device.due],
    description: t("viewer.marker", {
      label: device.number,
      type: device.typeName,
      state: t(`legend.${device.due}`),
    }),
  }));

  function setSpot(id: string, placement: Placement) {
    setSpots((current) => new Map(current).set(id, placement));
  }

  async function save(id: string, placement: Placement) {
    const result = placement
      ? await placeDevice({
          planId: placement.planId,
          deviceId: id,
          x: placement.x,
          y: placement.y,
        })
      : await removePlacement(id);
    if (result.ok) {
      saved.current.set(id, placement);
      return true;
    }
    // Back to what the server has.
    setSpot(id, saved.current.get(id) ?? null);
    toast(tErr(result.error), "danger");
    return false;
  }

  function scheduleSave(id: string, placement: Placement) {
    window.clearTimeout(timers.current.get(id));
    pending.current.set(id, placement);
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id);
        pending.current.delete(id);
        void save(id, placement);
      }, SAVE_DELAY),
    );
  }

  async function place(point: Point) {
    const id = placingId;
    if (!id) return;
    const device = byId.get(id);
    const placement = { planId: plan.id, ...point };
    setPlacingId(null);
    setSpot(id, placement);
    setSelectedId(id);
    if ((await save(id, placement)) && device) toast(t("panel.saved"), "success");
    router.refresh();
  }

  function move(id: string, point: Point) {
    const placement = { planId: plan.id, ...point };
    setSpot(id, placement);
    scheduleSave(id, placement);
  }

  async function remove(id: string) {
    const device = byId.get(id);
    window.clearTimeout(timers.current.get(id));
    pending.current.delete(id);
    setSpot(id, null);
    setSelectedId(null);
    if ((await save(id, null)) && device)
      toast(t("panel.removed", { label: device.number }), "success");
    router.refresh();
  }

  function select(id: string | null) {
    setSelectedId(id);
    if (id) viewer.current?.centerOn(id);
  }

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const DeviceIcon = OBJECT_TYPES.device.icon;
  const placing = placingId ? byId.get(placingId) : undefined;
  const counts = { overdue: 0, soon: 0, ok: 0, never: 0 } as Record<DueState, number>;
  for (const device of onPlan) counts[device.due]++;

  const deviceRow = (device: PlanDevice, action?: React.ReactNode, note?: string) => (
    <li
      key={device.id}
      className={cn(
        "flex min-h-11 items-center gap-2 px-[15px] py-1 shadow-[inset_0_-1px_0_var(--border)]",
        selectedId === device.id && "bg-primary/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          {
            overdue: "bg-[#db3737]",
            soon: "bg-[#bf7326]",
            ok: "bg-[#0f9960]",
            never: "bg-[#738694]",
          }[device.due],
        )}
      />
      <span className="min-w-0 flex-1">
        {device.placement?.planId === plan.id ? (
          <button
            type="button"
            onClick={() => select(device.id)}
            className="block font-mono font-semibold tabular-nums hover:underline"
          >
            {device.number}
          </button>
        ) : (
          <span className="block font-mono font-semibold tabular-nums">{device.number}</span>
        )}
        <span className="block truncate text-ui-sm text-muted-foreground">
          {[device.typeName, note ?? device.locationName].filter(Boolean).join(" · ")}
        </span>
      </span>
      {action}
    </li>
  );

  const section = (
    title: string,
    rows: PlanDevice[],
    render: (device: PlanDevice) => React.ReactNode,
    empty?: string,
  ) =>
    rows.length > 0 || empty ? (
      <div>
        <p className="bg-muted px-[15px] py-1 text-ui-sm font-semibold text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
          {title} <span className="font-normal tabular-nums">({rows.length})</span>
        </p>
        {rows.filter(matches).length > 0 ? (
          <ul>{rows.filter(matches).map(render)}</ul>
        ) : (
          <p className="px-[15px] py-3 text-ui text-muted-foreground">
            {rows.length > 0 ? t("panel.noneFound") : empty}
          </p>
        )}
      </div>
    ) : null;

  const placeButton = (device: PlanDevice, label: string) =>
    editable ? (
      <Button
        size="sm"
        variant={placingId === device.id ? "primary" : "outline"}
        aria-pressed={placingId === device.id}
        onClick={() => {
          setSelectedId(null);
          setPlacingId(placingId === device.id ? null : device.id);
        }}
      >
        <PinIcon />
        {label}
      </Button>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:gap-[15px] lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-2.5">
        <Card className="overflow-hidden">
          <PlanViewer
            ref={viewer}
            name={plan.name}
            imageUrl={plan.imageUrl}
            size={{ width: plan.width, height: plan.height }}
            markers={markers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            editable={editable && editing}
            onMove={move}
            placing={Boolean(placing)}
            onPlace={place}
            focusId={null}
            onReload={() => router.refresh()}
            className="h-[62dvh] min-h-[320px] rounded-lg lg:h-[calc(100dvh-190px)] lg:min-h-[480px]"
          >
            {placing && (
              <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex justify-center">
                <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-md bg-[#182026]/90 py-1.5 ps-3 pe-1.5 text-ui text-white shadow-elevation-3">
                  <MapMarkerIcon className="shrink-0" />
                  <span className="min-w-0">{t("panel.placing", { label: placing.number })}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/15 [&_svg]:text-white"
                    onClick={() => setPlacingId(null)}
                  >
                    <CrossIcon />
                    {t("panel.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </PlanViewer>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
          <PlanLegend
            items={(["overdue", "soon", "ok", "never"] as const).map((state) => ({
              tone: DUE_TONE[state],
              label: t(`legend.${state}`),
              count: counts[state],
            }))}
          />
          {editable && onPlan.length > 0 && (
            <Button
              variant={editing ? "primary" : "outline"}
              aria-pressed={editing}
              onClick={() => {
                setEditing(!editing);
                setPlacingId(null);
              }}
            >
              <EditIcon />
              {editing ? t("panel.editDone") : t("panel.edit")}
            </Button>
          )}
        </div>
        {editable && editing && (
          <p className="px-1 text-ui-sm text-muted-foreground">{t("panel.editHint")}</p>
        )}
      </div>

      <div className="space-y-2.5 sm:space-y-[15px]">
        {selected && (
          <Card>
            <CardHeader
              actions={
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={t("panel.cancel")}
                  onClick={() => setSelectedId(null)}
                >
                  <CrossIcon />
                </Button>
              }
            >
              <CardTitle className="font-mono tabular-nums">
                {selected.number}{" "}
                <span className="font-sans font-normal text-muted-foreground">
                  {selected.typeName}
                </span>
              </CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-[15px] py-2.5 text-ui">
              <dt className="text-muted-foreground">{t("panel.location")}</dt>
              <dd className="min-w-0 truncate">{selected.locationName ?? t("panel.noLocation")}</dd>
              <dt className="text-muted-foreground">{t("panel.nextDue")}</dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                {selected.nextDue
                  ? format.dateTime(calendarDate(selected.nextDue), CALENDAR_FORMAT)
                  : "—"}
                <Badge variant={DUE_BADGE[selected.due]}>{t(`legend.${selected.due}`)}</Badge>
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2 px-[15px] pb-[15px]">
              <Button asChild variant="outline" size="sm">
                <Link href={`/devices/${selected.id}`}>
                  <DeviceIcon />
                  {t("panel.openDevice")}
                </Link>
              </Button>
              {editable && selected.placement?.planId === plan.id && (
                <Button
                  variant="destructiveMinimal"
                  size="sm"
                  onClick={() => void remove(selected.id)}
                >
                  <TrashIcon />
                  {t("panel.remove")}
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                inputMode="numeric"
                aria-label={t("panel.search")}
                placeholder={t("panel.search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ps-[30px]"
              />
            </div>
          </div>
          {devices.length === 0 ? (
            <p className="px-[15px] py-6 text-center text-ui text-muted-foreground">
              {t("panel.noDevices")}
            </p>
          ) : (
            <div className="max-h-none lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto">
              {section(
                t("panel.unplaced"),
                unplaced,
                (device) => deviceRow(device, placeButton(device, t("panel.place"))),
                t("panel.allPlaced"),
              )}
              {section(
                t("panel.onPlan"),
                onPlan,
                (device) => deviceRow(device),
                t("panel.noneOnPlan"),
              )}
              {section(t("panel.elsewhere"), elsewhere, (device) =>
                deviceRow(
                  device,
                  placeButton(device, t("panel.moveHere")),
                  t("panel.onOtherPlan", { plan: planName.get(device.placement!.planId) ?? "" }),
                ),
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
