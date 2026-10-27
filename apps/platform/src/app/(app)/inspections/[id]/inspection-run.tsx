"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  CameraIcon,
  ChevronRightIcon,
  ConfirmIcon,
  CrossIcon,
  DisableIcon,
  DotIcon,
  ErrorIcon,
  KeyIcon,
  SearchIcon,
  TickIcon,
  WarningSignIcon,
  type IconComponent,
} from "@/components/icons";
import {
  PlanLegend,
  PlanViewer,
  type MarkerTone,
  type PlanMarker,
} from "@/components/app/plan-viewer";
import { QrScanner } from "@/components/app/qr-scanner";
import { ScanLocationBadge } from "@/components/app/scan-location-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { labelQuery } from "@/lib/devices";
import {
  isHandled,
  type DeviceView,
  type FieldDevice,
  type FieldDeviceType,
  type FieldLocation,
  type FieldState,
} from "@/lib/field";
import { readScan } from "@/lib/inspections";
import { markScanLocationExplained, scanLocationExplained } from "@/lib/client/scan-location";
import { cn } from "@/lib/utils";
import { AddDeviceButton } from "./add-device-dialog";

type Tab = "remaining" | "done" | "all";
type ViewMode = "list" | "plan";

const RUN_TONE: Record<FieldState, MarkerTone> = {
  passed: "success",
  failed: "danger",
  skipped: "muted",
  open: "warning",
  held: "warning",
  remaining: "neutral",
};

/** The list or the plan: remembered on this phone for the next inspection. */
const VIEW_KEY = "sparxdeck.inspection.view";

function storedView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "plan" ? "plan" : "list";
  } catch {
    return "list"; // Storage unavailable (private mode).
  }
}

function subscribeView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export type RunPlan = {
  id: string;
  name: string;
  width: number;
  height: number;
  /** The phone's copy of the image, or the signed link while it downloads. */
  imageUrl: string | null;
};

/**
 * The inspection on the phone: progress, the scanner and the building's devices
 * in route order, each with its state in the phone (also what waits to be sent).
 * Opening a device, scanning and the plan work without a signal. With the
 * company's scan location on, a scan also records the phone's position (the
 * first scan on a phone explains why).
 */
export function InspectionRun({
  inspectionId,
  accessNotes,
  devices,
  views,
  appUrl,
  plans,
  placements,
  addDevice,
  offline,
  status,
  scanLocation,
  onOpen,
  onScanned,
  onComplete,
  onAdded,
  onReloadPlan,
}: {
  inspectionId: string;
  accessNotes: string | null;
  devices: FieldDevice[];
  views: Record<string, DeviceView>;
  appUrl: string;
  plans: RunPlan[];
  placements: Record<string, { planId: string; x: number; y: number }>;
  /** Device types and locations for adding a device found in the building. */
  addDevice: { types: FieldDeviceType[]; locations: FieldLocation[] };
  offline: boolean;
  /** The connection and sending card, under the progress. */
  status: React.ReactNode;
  /** The company records the position of scans. */
  scanLocation: boolean;
  onOpen: (deviceId: string) => void;
  /** A device was opened by scanning its label (its position is recorded). */
  onScanned: (deviceId: string) => void;
  onComplete: () => void;
  onAdded: (deviceId: string) => void;
  onReloadPlan: () => void;
}) {
  const t = useTranslations("inspections");
  const tSites = useTranslations("sites.detail");
  const tPlans = useTranslations("plans");
  const tLocation = useTranslations("scanLocation");
  const tCommon = useTranslations("common");
  const [tab, setTab] = useState<Tab>("remaining");
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [intro, setIntro] = useState(false);
  const remembered = useSyncExternalStore(subscribeView, storedView, () => "list" as const);
  const [chosen, setChosen] = useState<ViewMode | null>(null);
  const mode: ViewMode = plans.length ? (chosen ?? remembered) : "list";
  const [planId, setPlanId] = useState(() => plans[0]?.id ?? null);

  function changeMode(next: ViewMode) {
    setChosen(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; nothing else depends on it.
    }
  }

  const checkUrl = (deviceId: string) => `/inspections/${inspectionId}/check/${deviceId}`;
  const viewOf = (id: string): DeviceView =>
    views[id] ?? {
      state: "remaining",
      skipReason: null,
      pending: false,
      conflict: null,
      error: null,
      heldBy: null,
      checkedBy: null,
      location: null,
      locationNote: null,
    };
  const finished = (id: string) => isHandled(viewOf(id));
  const done = devices.filter((device) => finished(device.id));
  const passed = done.filter((device) => viewOf(device.id).state === "passed").length;
  const failed = done.filter((device) => viewOf(device.id).state === "failed").length;
  const skipped = done.length - passed - failed;

  const onScan = useCallback(
    (text: string) => {
      const result = readScan(text, appUrl);
      const device = !result
        ? undefined
        : "token" in result
          ? devices.find((candidate) => candidate.token === result.token)
          : devices.find((candidate) => candidate.labelNumber === result.labelNumber);
      if (device) {
        setScanMessage(null);
        setScanning(false);
        onScanned(device.id);
        onOpen(device.id);
        return;
      }
      setScanMessage(result ? t("run.notInSite") : t("run.unknownCode"));
    },
    [appUrl, devices, onOpen, onScanned, t],
  );

  const number = labelQuery(query);
  const shown = devices.filter((device) => {
    if (query.trim() && (number === null || !String(device.labelNumber).startsWith(String(number))))
      return false;
    if (tab === "remaining") return !finished(device.id);
    if (tab === "done") return finished(device.id);
    return true;
  });
  const groups: { key: string; name: string | null; rows: FieldDevice[] }[] = [];
  for (const device of shown) {
    const key = device.locationName ?? "";
    const group = groups.at(-1);
    if (group?.key === key) group.rows.push(device);
    else groups.push({ key, name: device.locationName, rows: [device] });
  }

  const state = (device: FieldDevice): { icon: IconComponent; tone: string; text: string } => {
    const view = viewOf(device.id);
    if (view.conflict)
      return { icon: WarningSignIcon, tone: "text-warning-text", text: t("field.conflict") };
    if (view.error)
      return { icon: ErrorIcon, tone: "text-destructive-text", text: t("field.refused") };
    const pending = view.pending ? ` · ${t("field.waiting")}` : "";
    switch (view.state) {
      case "passed":
        return {
          icon: TickIcon,
          tone: "text-success-text",
          text: t("outcome.passed") + pending,
        };
      case "failed":
        return {
          icon: CrossIcon,
          tone: "text-destructive-text",
          text: t("outcome.failed") + pending,
        };
      case "skipped":
        return {
          icon: DisableIcon,
          tone: "text-muted-foreground",
          text: t(`outcome.${view.skipReason ?? "skipped"}`) + pending,
        };
      case "held":
        return {
          icon: DotIcon,
          tone: "text-warning-text",
          text: t("run.heldBy", { name: view.heldBy ?? "?" }),
        };
      case "open":
        return {
          icon: DotIcon,
          tone: "text-warning-text",
          text: view.pending ? t("field.openInPhone") : t("outcome.open"),
        };
      default:
        return { icon: DotIcon, tone: "text-subtle", text: t("outcome.remaining") };
    }
  };

  const plan = plans.find((item) => item.id === planId) ?? plans[0] ?? null;
  const planMarkers: PlanMarker[] = plan
    ? devices.flatMap((device) => {
        const spot = placements[device.id];
        if (spot?.planId !== plan.id) return [];
        return [
          {
            id: device.id,
            x: spot.x,
            y: spot.y,
            label: device.number,
            tone: RUN_TONE[viewOf(device.id).state],
            description: tPlans("viewer.marker", {
              label: device.number,
              type: device.typeName,
              state: state(device).text,
            }),
          },
        ];
      })
    : [];
  const legend = ["remaining", "open", "passed", "failed", "skipped"] as const;
  const onPlanCounts: Record<(typeof legend)[number], number> = {
    remaining: 0,
    open: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
  for (const device of devices)
    if (placements[device.id]?.planId === plan?.id) {
      const current = viewOf(device.id).state;
      onPlanCounts[current === "held" ? "open" : current]++;
    }
  const notOnPlan = devices.filter((device) => !placements[device.id]).length;
  const showPlan = mode === "plan" && plan !== null;

  return (
    <div className="space-y-2.5 sm:space-y-[15px]">
      {accessNotes && (
        <Alert variant="info" icon={KeyIcon} title={tSites("access")}>
          <p className="break-words whitespace-pre-line">{accessNotes}</p>
        </Alert>
      )}

      <Card className="p-[15px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-ui-lg font-semibold tabular-nums" aria-live="polite">
            {t("run.progress", { done: done.length, total: devices.length })}
          </p>
          <p className="flex gap-3 text-ui">
            <span className="text-success-text">
              {passed} × {t("outcome.passed")}
            </span>
            {failed > 0 && (
              <span className="text-destructive-text">
                {failed} × {t("outcome.failed")}
              </span>
            )}
            {skipped > 0 && (
              <span className="text-muted-foreground">{t("run.skipped", { count: skipped })}</span>
            )}
          </p>
        </div>
        <div
          aria-hidden
          className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[rgb(138_155_168/0.25)]"
        >
          <span
            className="h-full bg-success"
            style={{ width: `${devices.length ? (passed / devices.length) * 100 : 0}%` }}
          />
          <span
            className="h-full bg-destructive"
            style={{ width: `${devices.length ? (failed / devices.length) * 100 : 0}%` }}
          />
          <span
            className="h-full bg-[#a7b6c2]"
            style={{ width: `${devices.length ? (skipped / devices.length) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-[15px] grid grid-cols-1 gap-2 sm:flex">
          <Button
            size="lg"
            onClick={() => {
              setScanMessage(null);
              // Before the first scan on this phone: why the position is recorded.
              if (scanLocation && !scanLocationExplained()) setIntro(true);
              else setScanning(true);
            }}
          >
            <CameraIcon />
            {t("run.scan")}
          </Button>
          <Button asChild size="lg" variant="outline">
            {/* Completing needs the server: the page checks the signal and what waits first. */}
            <a
              href={`/inspections/${inspectionId}/complete`}
              onClick={(event) => {
                event.preventDefault();
                onComplete();
              }}
            >
              <ConfirmIcon />
              {t("run.complete")}
            </a>
          </Button>
          <AddDeviceButton
            inspectionId={inspectionId}
            types={addDevice.types}
            locations={addDevice.locations}
            offline={offline}
            onAdded={onAdded}
          />
        </div>
        {status}
      </Card>

      <Card>
        {plans.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)]">
            <div
              role="radiogroup"
              aria-label={tPlans("run.view")}
              className="flex flex-1 rounded-lg bg-canvas p-0.5 sm:flex-none"
            >
              {(["list", "plan"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  onClick={() => changeMode(id)}
                  className={cn(
                    "min-h-[30px] flex-1 rounded-[3px] px-4 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                    mode === id
                      ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                      : "text-muted-foreground",
                  )}
                >
                  {tPlans(`run.${id}`)}
                </button>
              ))}
            </div>
            {showPlan && plans.length > 1 && (
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <NativeSelect
                  aria-label={tPlans("title")}
                  value={plan.id}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  {plans.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>
        )}

        {showPlan ? (
          <>
            <PlanViewer
              key={plan.id}
              name={plan.name}
              imageUrl={plan.imageUrl}
              size={{ width: plan.width, height: plan.height }}
              markers={planMarkers}
              onSelect={(id) => id && onOpen(id)}
              onReload={onReloadPlan}
              fitShape
              className="max-h-[65dvh] min-h-[260px] w-full"
            />
            <div className="space-y-1.5 px-[15px] py-2.5 shadow-[inset_0_1px_0_var(--border)]">
              <PlanLegend
                items={legend.map((id) => ({
                  tone: RUN_TONE[id],
                  label: t(`outcome.${id}`),
                  count: onPlanCounts[id],
                }))}
              />
              {planMarkers.length === 0 && (
                <p className="text-ui text-muted-foreground">{tPlans("run.noneOnPlan")}</p>
              )}
              {notOnPlan > 0 && (
                <p className="text-ui-sm text-muted-foreground">
                  {tPlans("run.notOnPlan", { count: notOnPlan })}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)] sm:flex-row sm:items-center sm:justify-between">
              <div role="tablist" className="flex rounded-lg bg-canvas p-0.5">
                {(
                  [
                    ["remaining", t("run.remaining"), devices.length - done.length],
                    ["done", t("run.done"), done.length],
                    ["all", t("run.all"), devices.length],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "min-h-[30px] flex-1 rounded-[3px] px-3 text-ui whitespace-nowrap pointer-coarse:min-h-11",
                      tab === id
                        ? "bg-segment-active font-semibold text-segment-active-foreground shadow-segment"
                        : "text-muted-foreground",
                    )}
                  >
                    {label} <span className="tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:max-w-[200px]">
                <SearchIcon className="pointer-events-none absolute start-[7px] top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  inputMode="numeric"
                  aria-label={t("run.search")}
                  placeholder={t("run.search")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="ps-[30px]"
                />
              </div>
            </div>

            {devices.length === 0 ? (
              <p className="px-[15px] py-6 text-center text-muted-foreground">
                {t("run.noDevices")}
              </p>
            ) : shown.length === 0 ? (
              <p className="px-[15px] py-6 text-center text-muted-foreground">
                {query.trim()
                  ? t("run.emptySearch")
                  : tab === "remaining"
                    ? t("run.emptyRemaining")
                    : t("run.emptyDone")}
              </p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li key={group.key}>
                    {group.name && (
                      <p className="bg-muted px-[15px] py-1 text-ui-sm font-semibold text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
                        {group.name}
                      </p>
                    )}
                    <ul>
                      {group.rows.map((device) => {
                        const status = state(device);
                        return (
                          <li key={device.id}>
                            {/* A real link (new tab works); here it opens without the server. */}
                            <a
                              href={checkUrl(device.id)}
                              onClick={(event) => {
                                if (
                                  event.metaKey ||
                                  event.ctrlKey ||
                                  event.shiftKey ||
                                  event.altKey
                                )
                                  return;
                                event.preventDefault();
                                onOpen(device.id);
                              }}
                              className="flex min-h-14 items-center gap-3 px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)] hover:bg-accent"
                            >
                              <status.icon size={20} className={cn("shrink-0", status.tone)} />
                              <span className="min-w-0 flex-1">
                                <span className="block font-mono text-ui-lg font-semibold tabular-nums">
                                  {device.number}
                                </span>
                                <span className="block truncate text-ui-sm text-muted-foreground">
                                  {[device.typeName, device.serialNumber]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                                {viewOf(device.id).location && (
                                  <ScanLocationBadge
                                    state={viewOf(device.id).location!}
                                    className="mt-1"
                                  />
                                )}
                              </span>
                              <span className={cn("shrink-0 text-end text-ui-sm", status.tone)}>
                                {status.text}
                              </span>
                              <ChevronRightIcon className="shrink-0 text-subtle rtl:rotate-180" />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <QrScanner
        open={scanning}
        onOpenChange={setScanning}
        onResult={onScan}
        message={scanMessage}
      />

      <Dialog
        open={intro}
        onOpenChange={setIntro}
        title={tLocation("introTitle")}
        closeLabel={tCommon("close")}
      >
        <div className="space-y-3 text-ui">
          <p>{tLocation("introText")}</p>
          <p className="text-muted-foreground">{tLocation("introPermission")}</p>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                markScanLocationExplained();
                setIntro(false);
                setScanning(true);
              }}
            >
              {tLocation("introOk")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
