"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CameraIcon,
  ChevronRightIcon,
  ConfirmIcon,
  CrossIcon,
  DotIcon,
  KeyIcon,
  SearchIcon,
  TickIcon,
  type IconComponent,
} from "@/components/icons";
import { QrScanner } from "@/components/app/qr-scanner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { devicesWithDrafts, subscribeDrafts } from "@/lib/client/check-drafts";
import { labelQuery } from "@/lib/devices";
import type { RunCheck, RunDevice } from "@/lib/inspection-data";
import { readScan } from "@/lib/inspections";
import { cn } from "@/lib/utils";

type Tab = "remaining" | "done" | "all";

/** Unsent drafts live in localStorage; read them without a hydration mismatch. */
function useDrafts(inspectionId: string) {
  const snapshot = useSyncExternalStore(
    subscribeDrafts,
    () => devicesWithDrafts(inspectionId).sort().join(","),
    () => "",
  );
  return snapshot ? snapshot.split(",") : [];
}

/**
 * The inspection on the phone: progress, the scanner and the building's devices
 * in route order. Colleagues' progress appears when the page comes back into view.
 */
export function InspectionRun({
  inspectionId,
  accessNotes,
  devices,
  checks,
  appUrl,
}: {
  inspectionId: string;
  accessNotes: string | null;
  devices: RunDevice[];
  checks: Record<string, RunCheck>;
  appUrl: string;
}) {
  const t = useTranslations("inspections");
  const tSites = useTranslations("sites.detail");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("remaining");
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const drafts = useDrafts(inspectionId);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  const checkUrl = (deviceId: string) => `/inspections/${inspectionId}/check/${deviceId}`;
  const finished = (id: string) => {
    const outcome = checks[id]?.outcome;
    return outcome === "passed" || outcome === "failed";
  };
  const done = devices.filter((device) => finished(device.id));
  const passed = done.filter((device) => checks[device.id]?.outcome === "passed").length;
  const failed = done.length - passed;

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
        router.push(`/inspections/${inspectionId}/check/${device.id}`);
        return;
      }
      setScanMessage(result ? t("run.notInSite") : t("run.unknownCode"));
    },
    [appUrl, devices, inspectionId, router, t],
  );

  const number = labelQuery(query);
  const shown = devices.filter((device) => {
    if (query.trim() && (number === null || !String(device.labelNumber).startsWith(String(number))))
      return false;
    if (tab === "remaining") return !finished(device.id);
    if (tab === "done") return finished(device.id);
    return true;
  });
  const groups: { key: string; name: string | null; rows: RunDevice[] }[] = [];
  for (const device of shown) {
    const key = device.locationName ?? "";
    const group = groups.at(-1);
    if (group?.key === key) group.rows.push(device);
    else groups.push({ key, name: device.locationName, rows: [device] });
  }
  const draftLabels = devices
    .filter((device) => drafts.includes(device.id))
    .map((device) => device.number);

  const state = (device: RunDevice): { icon: IconComponent; tone: string; text: string } => {
    const check = checks[device.id];
    if (check?.outcome === "passed")
      return { icon: TickIcon, tone: "text-success-text", text: t("outcome.passed") };
    if (check?.outcome === "failed")
      return { icon: CrossIcon, tone: "text-destructive-text", text: t("outcome.failed") };
    if (check?.heldBy)
      return {
        icon: DotIcon,
        tone: "text-warning-text",
        text: t("run.heldBy", { name: check.heldBy }),
      };
    if (check) return { icon: DotIcon, tone: "text-warning-text", text: t("outcome.open") };
    return { icon: DotIcon, tone: "text-subtle", text: t("outcome.remaining") };
  };

  return (
    <div className="space-y-2.5 sm:space-y-[15px]">
      {accessNotes && (
        <Alert variant="info" icon={KeyIcon} title={tSites("access")}>
          <p className="break-words whitespace-pre-line">{accessNotes}</p>
        </Alert>
      )}
      {draftLabels.length > 0 && (
        <Alert variant="warning">{t("run.drafts", { labels: draftLabels.join(", ") })}</Alert>
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
        </div>
        <div className="mt-[15px] grid grid-cols-1 gap-2 sm:flex">
          <Button
            size="lg"
            onClick={() => {
              setScanMessage(null);
              setScanning(true);
            }}
          >
            <CameraIcon />
            {t("run.scan")}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/inspections/${inspectionId}/complete`}>
              <ConfirmIcon />
              {t("run.complete")}
            </Link>
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-2 px-2.5 py-2 shadow-[inset_0_-1px_0_var(--border)] sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" className="flex rounded-md bg-muted p-0.5">
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
                    ? "bg-background font-semibold shadow-elevation-1"
                    : "text-muted-foreground",
                )}
              >
                {label} <span className="text-muted-foreground tabular-nums">{count}</span>
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
          <p className="px-[15px] py-6 text-center text-muted-foreground">{t("run.noDevices")}</p>
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
                        <Link
                          href={checkUrl(device.id)}
                          className="flex min-h-14 items-center gap-3 px-[15px] py-2 shadow-[inset_0_-1px_0_var(--border)] hover:bg-[rgb(191_204_214/0.3)]"
                        >
                          <status.icon size={20} className={cn("shrink-0", status.tone)} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-ui-lg font-semibold tabular-nums">
                              {device.number}
                            </span>
                            <span className="block truncate text-ui-sm text-muted-foreground">
                              {[device.typeName, device.serialNumber].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className={cn("shrink-0 text-ui-sm", status.tone)}>
                            {status.text}
                          </span>
                          <ChevronRightIcon className="shrink-0 text-subtle rtl:rotate-180" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <QrScanner
        open={scanning}
        onOpenChange={setScanning}
        onResult={onScan}
        message={scanMessage}
      />
    </div>
  );
}
