"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { ClientPageHeader } from "@/components/app/client-page-header";
import { appIcon } from "@/components/app/nav-items";
import { OBJECT_TYPES } from "@/components/app/object-types";
import { PageBody } from "@/components/app/page-header-view";
import {
  CloudUploadIcon,
  ErrorIcon,
  OfflineIcon,
  RefreshIcon,
  TickCircleIcon,
  WarningSignIcon,
} from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  clearInspectionDrafts,
  devicesWithDrafts,
  draftKey,
  draftSnapshot,
  opsSnapshot,
  removeDraft,
  subscribeDrafts,
} from "@/lib/client/check-drafts";
import { devicesWithWork, requestTimeout, syncInspection } from "@/lib/client/field-sync";
import {
  PAGES_CACHE,
  forgetInspection,
  loadPack,
  planImage,
  savePack,
  savePlanImage,
} from "@/lib/client/offline-store";
import { queuedPhotoCounts, removeQueuedPhotos, subscribePhotos } from "@/lib/client/photo-queue";
import { deviceName } from "@/lib/devices";
import { CALENDAR_FORMAT, calendarDate } from "@/lib/due";
import {
  applySynced,
  deviceView,
  draftPending,
  fieldTally,
  mergePack,
  newerPack,
  templateOf,
  waitsForTechnician,
  type CheckDraft,
  type DeviceView,
  type FieldPack,
  type SyncedCheck,
} from "@/lib/field";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DeviceCheck } from "./check/[deviceId]/device-check";
import { CancelInspectionButton } from "./cancel-button";
import { InspectionRun, type RunPlan } from "./inspection-run";

const LOCATION_EVENT = "sparxdeck:field-location";
const CHECK_PATH = /^\/inspections\/[0-9a-f-]{36}\/check\/([0-9a-f-]{36})\/?$/i;

function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(LOCATION_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(LOCATION_EVENT, notify);
  };
}

/** The device open on screen, from the address (the page switches views without the server). */
function deviceInLocation(): string | null {
  return CHECK_PATH.exec(window.location.pathname)?.[1] ?? null;
}

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** Next.js files this page loaded, for the service worker to keep (see public/sw.js). */
async function keepStaticFiles() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const worker = registration?.active;
  if (!worker) return;
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType("resource"))
    if (entry.name.includes("/_next/static/")) urls.add(entry.name);
  document
    .querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]")
    .forEach((element) => {
      const url = "src" in element ? element.src : element.href;
      if (url.includes("/_next/static/")) urls.add(url);
    });
  worker.postMessage({ type: "cache-static", urls: [...urls] });
}

/** Keeps this inspection's page in the phone (the service worker serves it without a signal). */
async function keepPage(inspectionId: string) {
  const cache = await caches.open(PAGES_CACHE);
  const key = `/inspections/${inspectionId}`;
  if (await cache.match(key)) return;
  const response = await fetch(key, { credentials: "same-origin" });
  if (response.ok && !response.redirected && response.headers.get("content-type")?.includes("html"))
    await cache.put(key, response);
}

type Closed = "completed" | "missing" | null;

/**
 * An inspection in the field. The pack (everything the inspection needs) is kept
 * in the phone, so the list, the plan, the scanner and each device's check work
 * without a signal; switching between them doesn't ask the server. What the phone
 * does waits in it and is sent when there's a connection; a card says what is
 * waiting. Server pages render it for /inspections/<id> and for each device's
 * /inspections/<id>/check/<device>.
 */
export function FieldApp({
  initialPack,
  initialDevice,
  appUrl,
}: {
  initialPack: FieldPack;
  initialDevice: string | null;
  appUrl: string;
}) {
  const t = useTranslations("inspections");
  const tField = useTranslations("inspections.field");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const inspectionId = initialPack.inspection.id;

  const [pack, setPack] = useState(initialPack);
  const packRef = useRef(pack);
  const [offline, setOffline] = useState(false);
  const browserOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [syncing, setSyncing] = useState(false);
  const [stopped, setStopped] = useState<"retry" | "auth" | null>(null);
  const [closed, setClosed] = useState<Closed>(null);
  const [savedInPhone, setSavedInPhone] = useState(false);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [planUrls, setPlanUrls] = useState<Record<string, string>>({});
  const [completeHint, setCompleteHint] = useState<string | null>(null);
  const isOffline = offline || !browserOnline;

  const device = useSyncExternalStore(subscribeLocation, deviceInLocation, () => initialDevice);
  const activeRef = useRef<string | null>(device);
  useEffect(() => {
    packRef.current = pack;
  }, [pack]);
  useEffect(() => {
    activeRef.current = device;
  }, [device]);

  // ---------------------------------------------------------------------------
  // What waits in the phone
  // ---------------------------------------------------------------------------

  // Every draft's stored text, by device: any change to any of them re-renders.
  const draftsKey = useSyncExternalStore(
    subscribeDrafts,
    () =>
      JSON.stringify(
        Object.fromEntries(
          devicesWithDrafts(inspectionId)
            .sort()
            .map((id) => [id, localStorage.getItem(draftKey(inspectionId, id))]),
        ),
      ),
    () => "{}",
  );
  const ops = useSyncExternalStore(
    subscribeDrafts,
    () => opsSnapshot(inspectionId),
    () => "",
  );
  const drafts = useMemo(() => {
    const result: Record<string, CheckDraft | null> = {};
    for (const id of Object.keys(JSON.parse(draftsKey) as Record<string, string | null>))
      result[id] = draftSnapshot(draftKey(inspectionId, id));
    return result;
  }, [draftsKey, inspectionId]);
  const opsCount = ops ? (JSON.parse(ops) as unknown[]).length : 0;

  useEffect(() => {
    const read = () => void queuedPhotoCounts(inspectionId).then(setPhotoCounts);
    read();
    return subscribePhotos(read);
  }, [inspectionId]);

  const views = useMemo(() => {
    const result: Record<string, DeviceView> = {};
    for (const item of pack.devices) result[item.id] = deviceView(pack, item, drafts[item.id]);
    return result;
  }, [pack, drafts]);
  // What the phone sends by itself, and what waits for the technician (a
  // conflict to decide, a refusal to read): both have to go before completing.
  const tally = useMemo(() => fieldTally(pack, drafts, photoCounts), [pack, drafts, photoCounts]);
  const pendingTotal = tally.checks + tally.photos + opsCount + tally.decide.length;
  const conflicts = pack.devices.filter((item) => views[item.id]?.conflict);
  const refusals = pack.devices.filter((item) => views[item.id]?.error);
  // Devices removed, decommissioned or moved meanwhile: the server refused the
  // phone's changes, and they can't be opened here, so they are offered for discarding.
  const goneRefused = tally.gone.filter((item) => waitsForTechnician(drafts[item.id]));
  const labelOf = (id: string) =>
    pack.devices.find((item) => item.id === id)?.number ??
    tally.gone.find((item) => item.id === id)?.number ??
    "?";

  // ---------------------------------------------------------------------------
  // The pack: the phone's copy, refreshed from the server while online
  // ---------------------------------------------------------------------------

  // When the phone last applied a check it sent: a pack the server made before
  // that doesn't know it yet and must not undo it.
  const sentAt = useRef(new Map<string, number>());
  const markSent = useCallback((ids: string[]) => {
    for (const id of ids) sentAt.current.set(id, Date.now());
  }, []);

  const refresh = useCallback(async () => {
    const started = Date.now();
    let response: Response;
    let data: FieldPack | { closed: true };
    try {
      // A weak signal mustn't leave it hanging: given up, it counts as none.
      response = await fetch(`/inspections/${inspectionId}/pack`, {
        cache: "no-store",
        signal: requestTimeout(30_000),
      });
      const json = response.headers.get("content-type")?.includes("json");
      if (response.status === 401 || response.redirected || (response.ok && !json)) {
        setStopped("auth");
        return;
      }
      if (response.status === 404) {
        setClosed("missing");
        return;
      }
      if (!response.ok) return;
      data = (await response.json()) as FieldPack | { closed: true };
    } catch {
      setOffline(true);
      return;
    }
    setOffline(false);
    setStopped((previous) => (previous === "auth" ? null : previous));
    if ("closed" in data) {
      setClosed("completed");
      return;
    }
    const keep = [...sentAt.current].filter(([, at]) => at >= started).map(([id]) => id);
    const pending = await devicesWithWork(inspectionId);
    setPack((previous) => mergePack(previous, data, keep, pending));
  }, [inspectionId]);

  // A page from the phone's cache may be older than the phone's pack.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadPack(inspectionId), devicesWithWork(inspectionId)]).then(
      ([stored, pending]) => {
        if (!cancelled && stored)
          setPack((previous) =>
            newerPack(stored, previous) === previous
              ? mergePack(stored, previous, [], pending)
              : mergePack(previous, stored, [], pending),
          );
      },
    );
    const first = setTimeout(() => void refresh(), 0);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, [inspectionId, refresh]);

  // Keep the pack and its plan images in the phone; once a visit, the page and
  // the app's files for the service worker too.
  const prepared = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await savePack(pack);
        if (!navigator.onLine) {
          if (!cancelled) setSavedInPhone(true);
          return;
        }
        for (const plan of pack.plans) {
          if (await planImage(plan.imagePath)) continue;
          const response = await fetch(plan.imageUrl).catch(() => null);
          if (response?.ok) await savePlanImage(plan.imagePath, await response.blob());
        }
        if (!prepared.current) {
          await keepPage(inspectionId).catch(() => undefined);
          // Load what the field needs later (the label decoder) while there's a signal.
          await import("jsqr").catch(() => undefined);
          await keepStaticFiles().catch(() => undefined);
          // Asks the browser not to clear it when space runs low; on phones only,
          // as desktop Firefox asks the office about it.
          if (window.matchMedia("(pointer: coarse)").matches) void navigator.storage?.persist?.();
          prepared.current = true;
        }
        if (!cancelled) setSavedInPhone(true);
      } catch {
        // Storage unavailable (private mode): the page still works while online.
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pack, inspectionId]);

  // Floor plans from the phone's copies.
  const planPaths = pack.plans.map((plan) => plan.imagePath).join("\n");
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void (async () => {
      const urls: Record<string, string> = {};
      for (const plan of packRef.current.plans) {
        const blob = await planImage(plan.imagePath);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        created.push(url);
        urls[plan.id] = url;
      }
      if (!cancelled) setPlanUrls(urls);
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [planPaths, savedInPhone]);

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------

  const syncingRef = useRef(false);
  const rerunRef = useRef(false);
  const closedRef = useRef<Closed>(null);
  useEffect(() => {
    closedRef.current = closed;
  }, [closed]);

  const applyAll = useCallback(
    (synced: Record<string, SyncedCheck>) => {
      if (Object.keys(synced).length === 0) return;
      markSent(Object.keys(synced));
      setPack((previous) =>
        Object.entries(synced).reduce(
          (next, [id, check]) => applySynced(next, id, check),
          previous,
        ),
      );
    },
    [markSent],
  );

  const sync = useCallback(async () => {
    if (closedRef.current) return;
    if (syncingRef.current) {
      rerunRef.current = true;
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      do {
        rerunRef.current = false;
        const result = await syncInspection(supabase, packRef.current, activeRef.current);
        applyAll(result.synced);
        if (result.refused) toast(tField("opsRefused", { count: result.refused }), "danger");
        if (result.stopped === "closed") {
          await refresh();
          break;
        }
        if (result.stopped === "offline") {
          setOffline(true);
          break;
        }
        setOffline(false);
        setStopped(result.stopped === "auth" || result.stopped === "retry" ? result.stopped : null);
        if (result.stopped) break;
      } while (rerunRef.current);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [supabase, applyAll, refresh, toast, tField]);

  // Shortly after a change in the phone, when the signal returns, and every so often.
  useEffect(() => {
    const timer = setTimeout(() => void sync(), 600);
    return () => clearTimeout(timer);
  }, [draftsKey, ops, photoCounts, device, sync]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      void refresh().then(() => sync());
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
      void sync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void sync();
    }, 15_000);
    // Colleagues' progress, in the list (a check being filled in doesn't need it).
    const fresh = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine && !activeRef.current)
        void refresh();
    }, 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      clearInterval(fresh);
    };
  }, [refresh, sync]);

  // ---------------------------------------------------------------------------
  // Completed or cancelled meanwhile
  // ---------------------------------------------------------------------------

  const showResult = useCallback(() => {
    router.replace(`/inspections/${inspectionId}`);
    router.refresh();
  }, [router, inspectionId]);

  useEffect(() => {
    if (!closed || pendingTotal > 0) return;
    void forgetInspection(inspectionId).then(() => {
      // The result page (completed) instead of the field.
      if (closed === "completed") showResult();
    });
  }, [closed, pendingTotal, inspectionId, showResult]);

  async function discardAll() {
    clearInspectionDrafts(inspectionId);
    await removeQueuedPhotos(inspectionId);
    await forgetInspection(inspectionId);
    if (closed === "completed") showResult();
    else router.replace(`/sites/${pack.inspection.siteId}`);
  }

  async function discardGone() {
    for (const item of goneRefused) {
      removeDraft(draftKey(inspectionId, item.id));
      await removeQueuedPhotos(inspectionId, item.id);
    }
    toast(t("check.discarded"), "none");
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  const go = useCallback(
    (deviceId: string | null) => {
      const url = deviceId
        ? `/inspections/${inspectionId}/check/${deviceId}`
        : `/inspections/${inspectionId}`;
      window.history.pushState(null, "", url);
      window.dispatchEvent(new Event(LOCATION_EVENT));
      window.scrollTo({ top: 0 });
    },
    [inspectionId],
  );

  const current = device ? pack.devices.find((item) => item.id === device) : undefined;
  useEffect(() => {
    document.title = current
      ? `${deviceName(current.typeName, current.labelNumber)} · ${tCommon("appName")}`
      : `${t("title")}: ${pack.inspection.siteName} · ${tCommon("appName")}`;
  }, [current, pack.inspection.siteName, t, tCommon]);

  // A device not in the pack (added meanwhile): fetch a fresh one.
  useEffect(() => {
    if (!device || current) return;
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [device, current, refresh]);

  function complete() {
    setCompleteHint(null);
    if (isOffline) {
      setCompleteHint(tField("completeOffline"));
      return;
    }
    if (tally.decide.length > 0) {
      setCompleteHint(tField("completeDecide", { labels: tally.decide.map(labelOf).join(", ") }));
      return;
    }
    if (pendingTotal > 0) {
      setCompleteHint(tField("completePending", { count: pendingTotal }));
      void sync();
      return;
    }
    router.push(`/inspections/${inspectionId}/complete`);
  }

  async function added(deviceId: string) {
    await refresh();
    go(deviceId);
  }

  function done(synced: SyncedCheck | null) {
    if (synced && device) {
      markSent([device]);
      setPack((previous) => applySynced(previous, device, synced));
    }
    go(null);
    void sync();
  }

  const status = (
    <FieldStatus
      offline={isOffline}
      syncing={syncing}
      stopped={stopped}
      pendingChecks={tally.checks}
      pendingPhotos={tally.photos}
      pendingOps={opsCount}
      toDecide={tally.decide.length}
      savedInPhone={savedInPhone}
      fetchedAt={pack.fetchedAt}
      loginHref={`/login?next=${encodeURIComponent(`/inspections/${inspectionId}`)}`}
      onSync={() => {
        void refresh();
        void sync();
      }}
    />
  );

  const labelsOf = (list: { id: string }[]) => list.map((item) => labelOf(item.id)).join(", ");
  const closedAlert = closed && pendingTotal > 0 && (
    <Alert
      variant="error"
      icon={ErrorIcon}
      title={closed === "completed" ? tField("closedCompleted") : tField("closedMissing")}
    >
      <p>
        {tField("closedPending", {
          labels:
            labelsOf(
              [...pack.devices, ...tally.gone].filter((item) => draftPending(drafts[item.id])),
            ) || tField("closedSomething"),
        })}
      </p>
      <Button size="sm" variant="outline" className="mt-2.5" onClick={() => void discardAll()}>
        {tField("discardAll")}
      </Button>
    </Alert>
  );

  if (current) {
    const templateId = templateOf(pack, current, drafts[current.id]) ?? "";
    const view = views[current.id];
    const facts = [
      current.locationName && `${t("check.location")}: ${current.locationName}`,
      current.serialNumber && `${t("check.serial")}: ${current.serialNumber}`,
      current.lastInspectionOn &&
        `${t("check.lastInspection")}: ${format.dateTime(calendarDate(current.lastInspectionOn), CALENDAR_FORMAT)}`,
    ].filter(Boolean);
    return (
      <>
        <ClientPageHeader
          icon={OBJECT_TYPES.device.icon}
          iconClassName={OBJECT_TYPES.device.text}
          title={deviceName(current.typeName, current.labelNumber)}
          meta={view && <StateBadge view={view} />}
          breadcrumbs={[
            { label: t("title"), href: "/inspections" },
            {
              label: pack.inspection.siteName || t("title"),
              href: `/inspections/${inspectionId}`,
              onClick: (event) => {
                event.preventDefault();
                go(null);
              },
            },
          ]}
        />
        <PageBody width="narrow">
          {closedAlert}
          {facts.length > 0 && (
            <p className="mb-2.5 text-ui text-muted-foreground sm:mb-[15px]">{facts.join(" · ")}</p>
          )}
          <DeviceCheck
            key={`${current.id}:${templateId}`}
            inspectionId={inspectionId}
            deviceId={current.id}
            organizationId={pack.organizationId}
            label={current.number}
            templateId={templateId}
            questions={pack.templates[templateId] ?? []}
            item={pack.items[current.id] ?? null}
            openDefects={pack.defects[current.id] ?? []}
            onTemplate={(next) => {
              setPack((previous) => {
                const item = previous.items[current.id];
                return item
                  ? {
                      ...previous,
                      items: { ...previous.items, [current.id]: { ...item, templateId: next } },
                    }
                  : {
                      ...previous,
                      activeTemplates: { ...previous.activeTemplates, [current.typeId]: next },
                    };
              });
              if (!pack.templates[next]) void refresh();
            }}
            onStale={() => void refresh()}
            onDone={done}
            onSent={(synced) => {
              markSent([current.id]);
              setPack((previous) => applySynced(previous, current.id, synced));
            }}
            onBack={() => go(null)}
          />
        </PageBody>
      </>
    );
  }

  const app = appIcon("inspections");
  const runPlans: RunPlan[] = pack.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    width: plan.width,
    height: plan.height,
    imageUrl: planUrls[plan.id] ?? (isOffline ? null : plan.imageUrl),
  }));
  return (
    <>
      <ClientPageHeader
        actions={
          pack.inspection.canCancel && (
            <CancelInspectionButton inspectionId={inspectionId} disabled={isOffline} />
          )
        }
        icon={app.icon}
        iconClassName={app.tone}
        title={pack.inspection.siteName || t("title")}
        meta={<Badge variant="primaryMinimal">{t("status.in_progress")}</Badge>}
        breadcrumbs={[
          { label: t("title"), href: "/inspections" },
          ...(pack.inspection.customerId && pack.inspection.customerName
            ? [
                {
                  label: pack.inspection.customerName,
                  href: `/customers/${pack.inspection.customerId}`,
                },
              ]
            : []),
        ]}
      />
      <PageBody width="medium">
        <div className="space-y-2.5 sm:space-y-[15px]">
          {closedAlert}
          {device && !current && (
            <Alert variant="warning">
              <p>{tField("notInInspection")}</p>
              <Button size="sm" variant="outline" className="mt-2.5" onClick={() => go(null)}>
                {t("check.back")}
              </Button>
            </Alert>
          )}
          {conflicts.length > 0 && (
            <Alert variant="warning" icon={WarningSignIcon} title={tField("conflictsTitle")}>
              {tField("conflictsBody", { labels: labelsOf(conflicts) })}
            </Alert>
          )}
          {refusals.length > 0 && (
            <Alert variant="error" icon={ErrorIcon} title={tField("refusedTitle")}>
              {tField("refusedBody", { labels: labelsOf(refusals) })}
            </Alert>
          )}
          {!closed && goneRefused.length > 0 && (
            <Alert variant="error" icon={ErrorIcon} title={tField("goneTitle")}>
              <p>{tField("goneBody", { labels: labelsOf(goneRefused) })}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2.5"
                onClick={() => void discardGone()}
              >
                {tField("goneDiscard")}
              </Button>
            </Alert>
          )}
          {completeHint && <Alert variant="warning">{completeHint}</Alert>}
          <InspectionRun
            inspectionId={inspectionId}
            accessNotes={pack.inspection.accessNotes}
            devices={pack.devices}
            views={views}
            appUrl={appUrl}
            plans={runPlans}
            placements={pack.placements}
            addDevice={{ types: pack.types, locations: pack.locations }}
            offline={isOffline}
            status={status}
            onOpen={go}
            onComplete={complete}
            onAdded={(id) => void added(id)}
            onReloadPlan={() => void refresh()}
          />
        </div>
      </PageBody>
    </>
  );
}

function StateBadge({ view }: { view: DeviceView }) {
  const t = useTranslations("inspections");
  if (view.state === "passed") return <Badge variant="success">{t("outcome.passed")}</Badge>;
  if (view.state === "failed") return <Badge variant="danger">{t("outcome.failed")}</Badge>;
  if (view.state === "skipped")
    return <Badge>{t(`outcome.${view.skipReason ?? "skipped"}`)}</Badge>;
  return null;
}

/** The connection, what waits in the phone, and whether the inspection is ready without a signal. */
function FieldStatus({
  offline,
  syncing,
  stopped,
  pendingChecks,
  pendingPhotos,
  pendingOps,
  toDecide,
  savedInPhone,
  fetchedAt,
  loginHref,
  onSync,
}: {
  offline: boolean;
  syncing: boolean;
  stopped: "retry" | "auth" | null;
  pendingChecks: number;
  pendingPhotos: number;
  pendingOps: number;
  /** Checks waiting for the technician's decision (conflicts, refusals). */
  toDecide: number;
  savedInPhone: boolean;
  fetchedAt: string;
  loginHref: string;
  onSync: () => void;
}) {
  const t = useTranslations("inspections.field");
  const format = useFormatter();
  const parts = [
    pendingChecks > 0 && t("checks", { count: pendingChecks }),
    pendingPhotos > 0 && t("photos", { count: pendingPhotos }),
    pendingOps > 0 && t("ops", { count: pendingOps }),
  ].filter(Boolean);
  const pending = parts.length > 0;
  const time = format.dateTime(new Date(fetchedAt), { timeStyle: "short" });

  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-[15px] flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md px-2.5 py-2 text-ui",
        offline || stopped || toDecide ? "bg-warning/10" : "bg-muted",
      )}
      data-testid="field-status"
    >
      {offline ? (
        <OfflineIcon className="shrink-0 text-warning-text" />
      ) : syncing && pending ? (
        <Spinner size={16} />
      ) : pending ? (
        <CloudUploadIcon className="shrink-0 text-warning-text" />
      ) : toDecide ? (
        <WarningSignIcon className="shrink-0 text-warning-text" />
      ) : (
        <TickCircleIcon className="shrink-0 text-success-text" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {offline
            ? t("offline")
            : stopped === "auth"
              ? t("auth")
              : stopped === "retry"
                ? t("retry")
                : pending
                  ? t("sending")
                  : toDecide
                    ? t("decide")
                    : t("synced")}
        </span>
        <span className="block text-ui-sm text-muted-foreground">
          {pending
            ? t("pending", { what: parts.join(", ") })
            : toDecide
              ? t("decideBody", { count: toDecide })
              : savedInPhone
                ? t("ready", { time })
                : t("preparing")}
        </span>
      </span>
      {stopped === "auth" ? (
        <Button asChild size="sm" variant="outline">
          <a href={loginHref}>{t("signIn")}</a>
        </Button>
      ) : (
        pending &&
        !offline && (
          <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
            <RefreshIcon />
            {t("sendNow")}
          </Button>
        )
      )}
    </div>
  );
}
