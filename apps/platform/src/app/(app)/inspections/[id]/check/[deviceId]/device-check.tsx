"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  AnnotationIcon,
  CameraIcon,
  ChevronLeftIcon,
  CrossIcon,
  DisableIcon,
  ErrorIcon,
  IssueIcon,
  MediaIcon,
  OfflineIcon,
  SmallCrossIcon,
  TickCircleIcon,
  TickIcon,
  WarningSignIcon,
} from "@/components/icons";
import { DefectRef, SeverityBadge } from "@/components/app/defect-badges";
import { SeverityPicker } from "@/components/app/severity-picker";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  draftKey,
  draftSnapshot,
  queueOps,
  readDraft,
  removeDraft,
  subscribeDrafts,
  updateDraft,
} from "@/lib/client/check-drafts";
import {
  claimCheck,
  failureOf,
  requestTimeout,
  settleDraft,
  submitCheck,
  uploadQueuedPhotos,
  type Failure,
} from "@/lib/client/field-sync";
import { compressImage } from "@/lib/client/image";
import {
  queuePhoto,
  queuedPhotos,
  removePhoto,
  removeQueuedPhotos,
} from "@/lib/client/photo-queue";
import type { ErrorCode } from "@/lib/errors";
import {
  draftPending,
  fullAnswers,
  type CheckConflict,
  type CheckDraft,
  type FieldItem,
  type OpenDefect,
  type SyncedCheck,
} from "@/lib/field";
import {
  EMPTY_ANSWER,
  defectSeverityOf,
  missingPhotos,
  missingRequired,
  outcomeOf,
  parseNumber,
  type AnswerDraft,
  type Question,
} from "@/lib/inspections";
import type { CheckSkipReason } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ResolveDialog } from "./resolve-dialog";
import { SkipDialog } from "./skip-dialog";

export type { OpenDefect } from "@/lib/field";

export type CheckPhoto = {
  /** Local key: the photo's database id, or the queue id while it waits. */
  key: string;
  questionId: string | null;
  url: string;
  status: "uploaded" | "waiting" | "uploading";
  photoId?: string;
  path?: string;
};

type Hold =
  | { state: "opening" }
  | { state: "held"; item: string }
  | { state: "offline" }
  | { state: "blocked"; item: string; name: string }
  | { state: "conflict"; item: string; conflict: CheckConflict }
  | { state: "lost"; item: string }
  | { state: "error"; error: ErrorCode };

const NOTES = "__device";
/** The most photos a check takes (as the database allows). */
const MAX_PHOTOS = 20;
/** The longest answer, note or device note the database takes. */
const MAX_TEXT = 2000;
/** How long "Done" waits for the server before it leaves the check to the phone's queue. */
const SEND_WAIT_MS = 8000;

function within<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

/**
 * One device's check on the phone. It works without a signal from the start:
 * every change is written to the phone first (a draft in localStorage, photos in
 * IndexedDB) and sent when there is a connection; "Done" without one keeps the
 * whole check with the time it was done, to be sent later. Online, the check is
 * held by one person: a colleague can take it over, and the first person is
 * told. A colleague's check made meanwhile is a conflict the technician decides.
 */
export function DeviceCheck({
  inspectionId,
  deviceId,
  organizationId,
  label,
  templateId,
  questions,
  item,
  openDefects,
  onTemplate,
  onStale,
  onDone,
  onSent,
  onBack,
}: {
  inspectionId: string;
  deviceId: string;
  organizationId: string;
  label: string;
  /** The checklist version shown. */
  templateId: string;
  questions: Question[];
  /** The server's state of the check in the phone's pack (null: not started). */
  item: FieldItem | null;
  openDefects: OpenDefect[];
  /** The server uses another checklist version for this check: show that one. */
  onTemplate: (templateId: string) => void;
  /** The pack is behind the server (a colleague's check): fetch a new one. */
  onStale: () => void;
  /** Done or left out: sent (with the server's answer) or kept in the phone. */
  onDone: (synced: SyncedCheck | null) => void;
  /** Sent after "Done" stopped waiting for the server (onDone had null). */
  onSent: (synced: SyncedCheck) => void;
  onBack: () => void;
}) {
  const t = useTranslations("inspections.check");
  const tSkip = useTranslations("inspections.skip");
  const tResolve = useTranslations("inspections.resolve");
  const tOutcome = useTranslations("inspections.outcome");
  const tErr = useTranslations("errors");
  const format = useFormatter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const key = draftKey(inspectionId, deviceId);
  const overviewHref = `/inspections/${inspectionId}`;

  const [hold, setHold] = useState<Hold>({ state: "opening" });
  const [base, setBase] = useState<Record<string, AnswerDraft>>(() => item?.answers ?? {});
  const [baseNotes, setBaseNotes] = useState(item?.notes ?? "");
  // The check's checked_at as this phone knows it: a later one is a colleague's.
  const [seen, setSeen] = useState<string | null>(item?.checkedAt ?? null);
  const [photos, setPhotos] = useState<CheckPhoto[]>(() =>
    (item?.photos ?? []).map((photo) => ({
      key: photo.id,
      photoId: photo.id,
      path: photo.path,
      questionId: photo.questionId,
      url: photo.url,
      status: "uploaded",
    })),
  );
  const [brokenPhotos, setBrokenPhotos] = useState<ReadonlySet<string>>(new Set());
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        Object.entries(item?.answers ?? {})
          .filter(([, answer]) => answer.note)
          .map(([id]) => id),
      ),
  );
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [missingPhoto, setMissingPhoto] = useState<ReadonlySet<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  // After a passed check: the open defects to offer for resolving.
  const [resolving, setResolving] = useState<{
    defects: OpenDefect[];
    synced: SyncedCheck | null;
  } | null>(null);
  const [resolvingPending, setResolvingPending] = useState(false);
  // Sending runs one pass at a time; a call during a pass waits for it and runs
  // another, so "Done" never sees answers that are merely still in flight.
  const answersQueue = useRef<Promise<void>>(Promise.resolve());
  const photosQueue = useRef<Promise<void>>(Promise.resolve());
  const objectUrls = useRef<string[]>([]);

  const draft = useSyncExternalStore(
    subscribeDrafts,
    () => draftSnapshot(key),
    () => null,
  );
  const answers = useMemo(() => ({ ...base, ...draft?.answers }), [base, draft]);
  const notes = draft?.notes ?? baseNotes;
  const waitingPhotos = photos.filter((photo) => photo.status !== "uploaded").length;
  const pending = Object.keys(draft?.answers ?? {}).length + (draft?.notes !== undefined ? 1 : 0);
  const heldItem = hold.state === "held" ? hold.item : null;
  const editable = hold.state === "opening" || hold.state === "held" || hold.state === "offline";
  const conflict = hold.state === "conflict" ? hold.conflict : (draft?.conflict ?? null);

  // ---------------------------------------------------------------------------
  // Holding the check
  // ---------------------------------------------------------------------------

  const handleFailure = useCallback(
    (failure: Failure) => {
      if (failure.kind === "offline" || failure.kind === "retry" || failure.kind === "auth") {
        setOffline(true);
        return;
      }
      if (failure.kind !== "error") return;
      if (failure.error === "checkTakenOver" && heldItem)
        setHold({ state: "lost", item: heldItem });
      else if (failure.error === "inspectionClosed")
        setHold({ state: "error", error: failure.error });
      else setNotice(tErr(failure.error));
    },
    [heldItem, tErr],
  );

  // The parent's callbacks and what the phone saw, read when needed: claiming
  // the check again on every render would take it back from a colleague.
  const latest = useRef({ seen, onStale, onTemplate });
  useEffect(() => {
    latest.current = { seen, onStale, onTemplate };
  }, [seen, onStale, onTemplate]);

  const open = useCallback(
    async (takeOver: boolean, knownSeen?: string | null) => {
      const current = readDraft(key);
      const answered = !!current && (Object.keys(current.answers).length > 0 || !!current.action);
      let lastSeen =
        knownSeen !== undefined
          ? knownSeen
          : current && "seen" in current
            ? (current.seen ?? null)
            : latest.current.seen;
      let claim = await claimCheck(supabase, {
        inspectionId,
        deviceId,
        templateId: answered ? (current?.templateId ?? templateId) : null,
        seen: lastSeen,
        takeOver: takeOver || !!current?.force,
      });
      if (claim.kind === "conflict" && !draftPending(current)) {
        // Nothing of ours to lose: show the colleague's check and carry on with it.
        lastSeen = claim.conflict.checkedAt;
        setSeen(lastSeen);
        latest.current.onStale();
        claim = await claimCheck(supabase, {
          inspectionId,
          deviceId,
          templateId: null,
          seen: lastSeen,
          takeOver: false,
        });
      }
      switch (claim.kind) {
        case "offline":
        case "retry":
        case "auth":
          setOffline(true);
          setHold((previous) => (previous.state === "opening" ? { state: "offline" } : previous));
          return;
        case "error":
          setHold({ state: "error", error: claim.error });
          return;
        case "busy":
          setOffline(false);
          setHold({ state: "blocked", item: claim.item, name: claim.name });
          return;
        case "conflict": {
          setOffline(false);
          const { conflict } = claim;
          updateDraft(key, (d) => ({ ...d, conflict }));
          setHold({ state: "conflict", item: claim.item, conflict });
          return;
        }
        case "held":
          setOffline(false);
          if (current?.force) updateDraft(key, (d) => ({ ...d, conflict: undefined }));
          if (!answered && claim.template && claim.template !== templateId) {
            latest.current.onTemplate(claim.template);
            return;
          }
          setHold({ state: "held", item: claim.item });
      }
    },
    [supabase, inspectionId, deviceId, key, templateId],
  );

  useEffect(() => {
    const first = setTimeout(() => void open(false), 0);
    // Back from the lock screen or a lost signal: make sure the check is still ours.
    const onVisible = () => {
      if (document.visibilityState === "visible") void open(false);
    };
    const onOnline = () => void open(false);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [open]);

  // ---------------------------------------------------------------------------
  // Sending changes while the check is open (all at once; the draft keeps the rest)
  // ---------------------------------------------------------------------------

  const sendChanges = useCallback(async () => {
    if (!heldItem) return;
    const current = readDraft(key);
    // Done or left out: "Done" itself sends it.
    if (!current || current.action || !draftPending(current)) return;
    setSaving(true);
    try {
      const result = await submitCheck(supabase, {
        item: heldItem,
        questions,
        draft: current,
        release: false,
      });
      if (result.kind !== "ok") {
        handleFailure(result);
        return;
      }
      setOffline(false);
      settleDraft(key, current, questions);
      setBase((previous) => {
        const next = { ...previous };
        for (const [id, answer] of Object.entries(current.answers)) {
          const question = questions.find((q) => q.id === id);
          if (question?.type === "number" && Number.isNaN(parseNumber(answer.number))) continue;
          next[id] = answer;
        }
        return next;
      });
      if (current.notes !== undefined) setBaseNotes(current.notes);
    } finally {
      setSaving(false);
    }
  }, [heldItem, key, questions, supabase, handleFailure]);

  const flush = useCallback(() => {
    // Runs even if the previous pass failed, so the queue never stalls.
    answersQueue.current = answersQueue.current.then(sendChanges, sendChanges);
    return answersQueue.current;
  }, [sendChanges]);

  // ---------------------------------------------------------------------------
  // Photos: compressed in the phone, queued in IndexedDB, then uploaded
  // ---------------------------------------------------------------------------

  const sendPhotos = useCallback(async () => {
    if (!heldItem) return;
    // Only an upload that went through says the signal is back.
    let uploaded = false;
    try {
      const result = await uploadQueuedPhotos(supabase, {
        organizationId,
        inspectionId,
        deviceId,
        item: heldItem,
        onUploading: (id) =>
          setPhotos((list) => list.map((p) => (p.key === id ? { ...p, status: "uploading" } : p))),
        onWaiting: (id) =>
          setPhotos((list) => list.map((p) => (p.key === id ? { ...p, status: "waiting" } : p))),
        onUploaded: (id, stored) => {
          uploaded = true;
          setPhotos((list) =>
            list.map((p) =>
              p.key === id
                ? {
                    ...p,
                    status: "uploaded",
                    photoId: stored.photoId ?? undefined,
                    path: stored.path,
                  }
                : p,
            ),
          );
        },
      });
      if (result.kind !== "ok") handleFailure(result);
      else if (uploaded) setOffline(false);
    } catch {
      // IndexedDB or the network failed mid-way: the photos stay queued for the next pass.
    }
  }, [heldItem, inspectionId, deviceId, organizationId, supabase, handleFailure]);

  const uploadPending = useCallback(() => {
    photosQueue.current = photosQueue.current.then(sendPhotos, sendPhotos);
    return photosQueue.current;
  }, [sendPhotos]);

  // Photos left in the phone by an earlier visit.
  useEffect(() => {
    let cancelled = false;
    void queuedPhotos(inspectionId, deviceId).then((queued) => {
      if (cancelled || queued.length === 0) return;
      const restored = queued.map((photo) => {
        const url = URL.createObjectURL(photo.blob);
        objectUrls.current.push(url);
        return { key: photo.id, questionId: photo.questionId, url, status: "waiting" as const };
      });
      setPhotos((list) => [
        ...list.filter((p) => !queued.some((q) => q.id === p.key)),
        ...restored,
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionId, deviceId]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  // Send whatever waits: shortly after a change, when the signal returns, and every few seconds.
  useEffect(() => {
    if (!heldItem) return;
    const timer = setTimeout(() => {
      void flush();
      void uploadPending();
    }, 350);
    return () => clearTimeout(timer);
  }, [heldItem, draft, photos.length, flush, uploadPending]);

  useEffect(() => {
    const retry = () => {
      if (heldItem) {
        void flush();
        void uploadPending();
      } else if (hold.state === "offline") void open(false);
    };
    const interval = setInterval(() => {
      if (readDraft(key) || offline || hold.state === "offline") retry();
    }, 10_000);
    return () => clearInterval(interval);
  }, [heldItem, hold.state, key, offline, flush, uploadPending, open]);

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  /** A change to the draft; the first one notes the version and what the phone saw. */
  function change(patch: (draft: CheckDraft) => CheckDraft) {
    updateDraft(key, (d) =>
      patch({
        ...d,
        seen: "seen" in d ? d.seen : seen,
        templateId: d.templateId ?? templateId,
      }),
    );
  }

  function edit(question: Question, patch: Partial<AnswerDraft>) {
    const next = { ...EMPTY_ANSWER, ...answers[question.id], ...patch };
    change((d) => ({ ...d, answers: { ...d.answers, [question.id]: next } }));
    if (missing.has(question.id)) {
      setMissing((current) => {
        const copy = new Set(current);
        copy.delete(question.id);
        return copy;
      });
    }
  }

  async function addPhoto(questionId: string | null, file: File | undefined) {
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      toast(tErr("tooManyPhotos"), "danger");
      return;
    }
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      toast(tErr("photoFailed"), "danger");
      return;
    }
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    setPhotos((list) => [...list, { key: id, questionId, url, status: "waiting" }]);
    if (questionId && missingPhoto.has(questionId)) {
      setMissingPhoto((current) => {
        const copy = new Set(current);
        copy.delete(questionId);
        return copy;
      });
    }
    const stored = await queuePhoto({ id, inspectionId, deviceId, questionId, blob });
    if (!stored) {
      // Not in the phone's queue (storage full or blocked): it would never be sent.
      setPhotos((list) => list.filter((photo) => photo.key !== id));
      toast(tErr("photoFailed"), "danger");
    }
  }

  async function deletePhoto(photo: CheckPhoto) {
    if (photo.status !== "uploaded") {
      await removePhoto(photo.key);
      setPhotos((list) => list.filter((p) => p.key !== photo.key));
      return;
    }
    if (!photo.photoId) return;
    const { data: path, error } = await supabase
      .rpc("delete_inspection_photo", { p_photo: photo.photoId })
      .abortSignal(requestTimeout());
    if (error) {
      handleFailure(failureOf(error));
      return;
    }
    await supabase.storage.from("org-assets").remove([path ?? photo.path ?? ""]);
    setPhotos((list) => list.filter((p) => p.key !== photo.key));
  }

  /**
   * Sends the finished (or left out) check now, if the phone holds it and the
   * server answers soon enough; otherwise it stays in the phone's queue.
   */
  async function sendNow(): Promise<SyncedCheck | "queued" | "failed"> {
    if (!heldItem) return "queued";
    // Set once "Done" stops waiting: the technician has moved on by then.
    let gaveUp = false;
    const attempt = (async (): Promise<SyncedCheck | "queued" | "failed"> => {
      await uploadPending();
      const current = readDraft(key);
      if (!current) return "queued";
      const result = await submitCheck(supabase, {
        item: heldItem,
        questions,
        draft: current,
        release: true,
      });
      if (result.kind !== "ok") {
        // A late refusal stays with the queue, which shows it in the list.
        if (gaveUp) return "queued";
        if (result.kind === "error") {
          // Refused: the technician fixes it here; the check isn't done yet.
          updateDraft(key, (d) => ({ ...d, action: undefined, checkedAt: undefined }));
          handleFailure(result);
          return "failed";
        }
        handleFailure(result);
        return "queued";
      }
      settleDraft(key, current, questions);
      const synced: SyncedCheck = {
        item: heldItem,
        template: templateId,
        sent: current,
        outcome: result.outcome,
        checkedAt: result.checkedAt,
      };
      if (gaveUp) onSent(synced);
      return synced;
    })();
    const result = await within(attempt, SEND_WAIT_MS);
    if (result !== "timeout") return result;
    gaveUp = true;
    return "queued";
  }

  /** Marks the check done (or left out) in the phone, with the whole check and its time. */
  function markDone(action: NonNullable<CheckDraft["action"]>, skipNote?: string) {
    const complete = fullAnswers(questions, base, draft?.answers ?? {});
    change((d) => ({
      ...d,
      answers: action.type === "finish" ? complete : d.answers,
      notes: skipNote ? skipNote : d.notes,
      action,
      checkedAt: new Date().toISOString(),
    }));
  }

  async function finish() {
    setNotice(null);
    const gaps = missingRequired(questions, answers);
    const photoCounts: Record<string, number> = {};
    for (const photo of photos)
      if (photo.questionId)
        photoCounts[photo.questionId] = (photoCounts[photo.questionId] ?? 0) + 1;
    const photoGaps = missingPhotos(questions, photoCounts);
    if (gaps.length > 0 || photoGaps.length > 0) {
      setMissing(new Set(gaps.map((q) => q.id)));
      setMissingPhoto(new Set(photoGaps.map((q) => q.id)));
      setNotice(
        [
          gaps.length > 0 && t("missingCount", { count: gaps.length }),
          photoGaps.length > 0 && t("missingPhotoCount", { count: photoGaps.length }),
        ]
          .filter(Boolean)
          .join(" "),
      );
      const first = questions.find((q) => gaps.includes(q) || photoGaps.includes(q));
      document.getElementById(`question-${first!.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setFinishing(true);
    markDone({ type: "finish" });
    const result = await sendNow();
    setFinishing(false);
    if (result === "failed") return;
    const outcome = result === "queued" ? outcomeOf(questions, answers) : result.outcome;
    const synced = result === "queued" ? null : result;
    if (synced)
      toast(
        outcome === "failed" ? t("finishedFailed", { label }) : t("finishedPassed", { label }),
        outcome === "failed" ? "danger" : "success",
      );
    else
      toast(
        t("savedInPhone", { label, outcome: tOutcome(outcome ?? "passed") }),
        outcome === "failed" ? "danger" : "none",
      );
    // A passed device with open defects: were they fixed?
    if (outcome === "passed" && openDefects.length > 0) {
      setResolving({ defects: openDefects, synced });
      return;
    }
    onDone(synced);
  }

  /** Leaves the device out: everything waiting in the phone goes with it. */
  async function skip(reason: CheckSkipReason, note: string) {
    setSkipping(true);
    setNotice(null);
    markDone({ type: "skip", reason }, note.trim() || undefined);
    const result = await sendNow();
    setSkipping(false);
    setSkipOpen(false);
    if (result === "failed") return;
    const text = tSkip("done", { label, reason: tSkip(`reasons.${reason}`) });
    toast(result === "queued" ? `${text}. ${t("queuedSuffix")}` : text, "none");
    onDone(result === "queued" ? null : result);
  }

  async function resolveDefects(ids: string[], note: string, synced: SyncedCheck | null) {
    setResolvingPending(true);
    let resolved = 0;
    const left: string[] = [];
    for (const id of ids) {
      const { error } = await supabase
        .rpc("change_defect_status", { p_defect: id, p_status: "resolved", p_note: note })
        .abortSignal(requestTimeout());
      if (!error) {
        resolved++;
        continue;
      }
      const failure = failureOf(error);
      if (failure.kind === "error") {
        toast(tErr(failure.error), "danger");
        continue;
      }
      left.push(id);
    }
    // Without a signal they wait in the phone with the check.
    if (left.length)
      queueOps(
        inspectionId,
        left.map((defectId) => ({ id: crypto.randomUUID(), type: "resolve", defectId, note })),
      );
    setResolvingPending(false);
    if (resolved) toast(tResolve("done", { count: resolved }), "success");
    if (left.length) toast(tResolve("queued", { count: left.length }), "none");
    setResolving(null);
    onDone(synced);
  }

  function leave() {
    // Free the check for colleagues, unless something still waits to be sent.
    if (heldItem && !readDraft(key) && waitingPhotos === 0)
      void supabase.rpc("release_device_check", { p_item: heldItem });
  }

  // ---------------------------------------------------------------------------
  // Conflicts and refusals
  // ---------------------------------------------------------------------------

  async function keepMine() {
    updateDraft(key, (d) => ({ ...d, force: true, conflict: undefined }));
    // A finished check goes with the phone's queue (it replaces the colleague's);
    // an unfinished one is taken over here and carries on.
    if (readDraft(key)?.action) {
      onDone(null);
      return;
    }
    setHold({ state: "opening" });
    await open(true);
  }

  async function discardMine(knownSeen: string | null) {
    removeDraft(key);
    await removeQueuedPhotos(inspectionId, deviceId);
    setPhotos((list) => list.filter((photo) => photo.status === "uploaded"));
    toast(t("discarded"), "none");
    setSeen(knownSeen);
    onStale();
    await open(false, knownSeen);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const outcome = outcomeOf(questions, answers);
  const canAddPhoto = editable && photos.length < MAX_PHOTOS;
  const photoInput = (questionId: string | null, labelText: string) => (
    <label
      className={cn(
        "inline-flex min-h-[30px] cursor-pointer items-center gap-[7px] rounded-md px-2.5 text-ui text-muted-foreground hover:bg-accent pointer-coarse:min-h-11",
        !canAddPhoto && "pointer-events-none opacity-50",
      )}
    >
      <CameraIcon className="text-[var(--btn-icon)]" />
      <span>{questionId ? t("addPhoto") : labelText}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={labelText}
        disabled={!canAddPhoto}
        data-testid={`photo-${questionId ?? NOTES}`}
        onChange={(event) => {
          void addPhoto(questionId, event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
  const photoStrip = (questionId: string | null) => {
    const list = photos.filter((photo) => photo.questionId === questionId);
    if (list.length === 0) return null;
    return (
      <ul className="flex flex-wrap gap-2">
        {list.map((photo, index) => (
          <li key={photo.key} className="relative">
            {brokenPhotos.has(photo.key) ? (
              // A photo on the server, its link out of reach without a signal.
              <span
                role="img"
                aria-label={t("photoAlt", { number: index + 1 })}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-md bg-muted text-center text-[10px] leading-tight text-muted-foreground shadow-[0_0_0_1px_var(--border)]"
              >
                <MediaIcon />
                {t("photoOnServer")}
              </span>
            ) : (
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- local and signed URLs */}
                <img
                  src={photo.url}
                  alt={t("photoAlt", { number: index + 1 })}
                  onError={() => setBrokenPhotos((current) => new Set(current).add(photo.key))}
                  className="size-20 rounded-md object-cover shadow-[0_0_0_1px_var(--border)]"
                />
              </a>
            )}
            {photo.status !== "uploaded" && (
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-md bg-[rgb(16_22_26/0.7)] py-0.5 text-[10px] text-white">
                {photo.status === "uploading" ? t("uploading") : t("photoWaiting")}
              </span>
            )}
            {editable && (photo.status !== "uploaded" || heldItem) && (
              <button
                type="button"
                aria-label={t("removePhoto", { number: index + 1 })}
                onClick={() => void deletePhoto(photo)}
                className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow-elevation-2 pointer-coarse:size-8"
              >
                <SmallCrossIcon />
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };
  const theirs = (value: CheckConflict) =>
    value.skipReason
      ? tOutcome(value.skipReason)
      : value.outcome
        ? tOutcome(value.outcome)
        : tOutcome("open");

  return (
    <div className="space-y-2.5 pb-2 sm:space-y-[15px]">
      {hold.state === "blocked" && (
        <Alert variant="warning" title={t("heldTitle", { name: hold.name })}>
          <p>{t("heldBody")}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void open(true)}>
              {t("takeOver")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={overviewHref}
                onClick={(event) => {
                  event.preventDefault();
                  onBack();
                }}
              >
                {t("back")}
              </Link>
            </Button>
          </div>
        </Alert>
      )}
      {hold.state === "lost" && (
        <Alert variant="error" title={t("lostTitle")}>
          <p>{t("lostBody")}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void open(true)}>
              {t("takeBack")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={overviewHref}
                onClick={(event) => {
                  event.preventDefault();
                  onBack();
                }}
              >
                {t("back")}
              </Link>
            </Button>
          </div>
        </Alert>
      )}
      {conflict && (
        <Alert
          variant="warning"
          icon={WarningSignIcon}
          title={t("conflictTitle", { name: conflict.name })}
        >
          <p>
            {t("conflictBody", {
              outcome: theirs(conflict),
              time: conflict.checkedAt
                ? format.dateTime(new Date(conflict.checkedAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "—",
            })}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void keepMine()}>
              {t("keepMine")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void discardMine(conflict.checkedAt)}
            >
              {t("keepTheirs")}
            </Button>
          </div>
        </Alert>
      )}
      {draft?.error && (
        <Alert variant="error" icon={ErrorIcon} title={t("refusedTitle")}>
          <p>{tErr(draft.error as ErrorCode)}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2.5"
            onClick={() => void discardMine(seen)}
          >
            {t("discard")}
          </Button>
        </Alert>
      )}
      {hold.state === "error" && (
        <Alert variant="error">
          <p>{tErr(hold.error)}</p>
          <Button size="sm" variant="outline" className="mt-2.5" onClick={onBack}>
            {t("back")}
          </Button>
        </Alert>
      )}
      {(offline || hold.state === "offline") && (
        <Alert variant="warning" icon={OfflineIcon}>
          {t("offlineHint")}
        </Alert>
      )}
      {item?.skipReason && !draft?.action && (
        <Alert
          variant="neutral"
          icon={DisableIcon}
          title={tSkip("currentTitle", { reason: tSkip(`reasons.${item.skipReason}`) })}
        >
          {item.notes && <p className="break-words whitespace-pre-line">{item.notes}</p>}
          <p>{tSkip("currentBody")}</p>
        </Alert>
      )}
      {openDefects.length > 0 && (
        <Alert variant="warning" icon={IssueIcon} title={t("openDefects")}>
          <ul className="space-y-1">
            {openDefects.map((defect) => (
              <li key={defect.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link
                  href={`/defects/${defect.id}`}
                  className="touch-link font-medium hover:underline"
                >
                  <DefectRef number={defect.number} />
                </Link>
                <SeverityBadge severity={defect.severity} />
                <span className="min-w-0 break-words">{defect.description}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <fieldset disabled={!editable || !!conflict} className="space-y-2.5 sm:space-y-[15px]">
        {questions.map((question, index) => {
          const answer = answers[question.id] ?? EMPTY_ANSWER;
          const isMissing = missing.has(question.id);
          const photoMissing = missingPhoto.has(question.id);
          const numberInvalid =
            question.type === "number" && Number.isNaN(parseNumber(answer.number));
          const noteOpen = openNotes.has(question.id);
          const failed = question.type === "pass_fail" && answer.pass === false;
          // The database adds a repeated "no" to the open defect of the same question.
          const existing = failed
            ? openDefects.find((defect) => defect.question === question.label)
            : undefined;
          const severity = defectSeverityOf(question, answer);
          return (
            <Card
              key={question.id}
              id={`question-${question.id}`}
              className={cn(
                "space-y-2.5 p-[15px]",
                (isMissing || photoMissing) && "ring-2 ring-destructive",
              )}
            >
              <p className="flex gap-2 text-ui-lg leading-6">
                <span className="text-muted-foreground tabular-nums">{index + 1}.</span>
                <span className="min-w-0 flex-1 font-medium">
                  {question.label}
                  {(question.required || question.photoRequired) && (
                    <span className="ms-1.5 text-ui-sm font-normal text-muted-foreground">
                      (
                      {[
                        question.required && t("required"),
                        question.photoRequired && t("photoRequired"),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      )
                    </span>
                  )}
                </span>
              </p>

              {question.type === "pass_fail" && (
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={question.label}>
                  {([true, false] as const).map((value) => {
                    const chosen = answer.pass === value;
                    return (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={chosen}
                        // A second tap keeps the answer: a double tap in the field must not clear it.
                        onClick={() => !chosen && edit(question, { pass: value })}
                        className={cn(
                          "flex h-12 items-center justify-center gap-2 rounded-md text-ui-lg font-medium transition-colors disabled:opacity-50",
                          chosen
                            ? value
                              ? "bg-success text-white"
                              : "bg-destructive text-white"
                            : "surface-button hover:bg-[var(--btn-bg-hover)]",
                        )}
                      >
                        {value ? <TickIcon size={20} /> : <CrossIcon size={20} />}
                        {value ? t("pass") : t("fail")}
                      </button>
                    );
                  })}
                </div>
              )}
              {failed &&
                (existing ? (
                  <p className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
                    <IssueIcon className="shrink-0" />
                    <span>
                      {t.rich("defectExisting", {
                        number: () => <DefectRef number={existing.number} />,
                      })}
                    </span>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-ui-sm font-medium text-muted-foreground">{t("defect")}</p>
                    <SeverityPicker
                      value={severity}
                      label={t("defectFor", { label: question.label })}
                      noneLabel={question.failCreatesDefect ? undefined : t("noDefect")}
                      onChange={(value) => edit(question, { severity: value })}
                    />
                    {severity && (
                      <p className="text-ui-sm text-muted-foreground">{t("defectHint")}</p>
                    )}
                  </div>
                ))}
              {question.type === "number" && (
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={question.label}
                  aria-invalid={numberInvalid || isMissing || undefined}
                  placeholder={t("numberPlaceholder")}
                  value={answer.number}
                  onChange={(event) => edit(question, { number: event.target.value })}
                  className="h-11 max-w-[220px] text-ui-lg"
                />
              )}
              {question.type === "text" && (
                <Textarea
                  rows={2}
                  maxLength={MAX_TEXT}
                  aria-label={question.label}
                  aria-invalid={isMissing || undefined}
                  placeholder={t("textPlaceholder")}
                  value={answer.text}
                  onChange={(event) => edit(question, { text: event.target.value })}
                />
              )}
              {numberInvalid && (
                <p className="text-ui-sm text-destructive-text">{t("numberInvalid")}</p>
              )}
              {isMissing && !numberInvalid && (
                <p className="text-ui-sm text-destructive-text">{t("missing")}</p>
              )}
              {photoMissing && (
                <p className="text-ui-sm text-destructive-text">{t("photoMissing")}</p>
              )}

              {noteOpen && (
                <Textarea
                  rows={2}
                  maxLength={MAX_TEXT}
                  autoCapitalize="sentences"
                  aria-label={t("note", { label: question.label })}
                  value={answer.note}
                  onChange={(event) => edit(question, { note: event.target.value })}
                />
              )}
              {photoStrip(question.id)}
              <div className="-ms-2.5 flex flex-wrap gap-1">
                {!noteOpen && (
                  <button
                    type="button"
                    onClick={() => setOpenNotes((current) => new Set(current).add(question.id))}
                    className="inline-flex min-h-[30px] items-center gap-[7px] rounded-md px-2.5 text-ui text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11"
                  >
                    <AnnotationIcon className="text-[var(--btn-icon)]" />
                    {t("addNote")}
                  </button>
                )}
                {photoInput(question.id, t("photoFor", { label: question.label }))}
              </div>
            </Card>
          );
        })}

        <Card className="space-y-2.5 p-[15px]">
          <p className="text-ui-lg font-medium">{t("deviceSection")}</p>
          <Textarea
            rows={2}
            maxLength={MAX_TEXT}
            autoCapitalize="sentences"
            aria-label={t("deviceNotes")}
            aria-describedby="dictation-hint"
            placeholder={t("deviceNotes")}
            value={notes}
            onChange={(event) => change((d) => ({ ...d, notes: event.target.value }))}
          />
          {/* Phones dictate into any text field; the keyboard's microphone does it. */}
          <p
            id="dictation-hint"
            className="hidden text-ui-sm text-muted-foreground pointer-coarse:block"
          >
            {t("dictationHint")}
          </p>
          {photoStrip(null)}
          <div className="-ms-2.5">{photoInput(null, t("devicePhoto"))}</div>
        </Card>
      </fieldset>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => setSkipOpen(true)}
          disabled={!editable || !!conflict || skipping || finishing}
          className="text-muted-foreground"
        >
          <DisableIcon />
          {tSkip("action")}
        </Button>
      </div>

      {notice && <Alert variant="error">{notice}</Alert>}

      <SkipDialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        pending={skipping}
        onSkip={(reason, note) => void skip(reason, note)}
      />
      {resolving && (
        <ResolveDialog
          defects={resolving.defects}
          pending={resolvingPending}
          onResolve={(ids, note) => void resolveDefects(ids, note, resolving.synced)}
          onKeep={() => {
            const synced = resolving.synced;
            setResolving(null);
            onDone(synced);
          }}
        />
      )}

      <div className="sticky bottom-0 z-10 -mx-2.5 -mb-8 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 bg-background px-2.5 py-2 shadow-[0_-1px_0_var(--border)] sm:-mx-[15px] sm:px-[15px] lg:-mx-5 lg:px-5">
        <Button asChild variant="outline" size="lg">
          <Link
            href={overviewHref}
            onClick={(event) => {
              event.preventDefault();
              leave();
              onBack();
            }}
          >
            <ChevronLeftIcon className="rtl:rotate-180" />
            {/* Icon only on the phone; screen readers always hear the label. */}
            <span className="sr-only sm:not-sr-only">{t("back")}</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-ui-sm" aria-live="polite">
          {conflict || draft?.error ? (
            <span className="inline-flex items-center gap-1.5 text-warning-text">
              <WarningSignIcon />
              {t("decideFooter")}
            </span>
          ) : hold.state === "opening" ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Spinner size={14} /> {t("opening")}
            </span>
          ) : offline || hold.state === "offline" ? (
            <span className="inline-flex items-center gap-1.5 text-warning-text">
              <OfflineIcon />
              {t("offline", { count: pending + waitingPhotos })}
            </span>
          ) : pending + waitingPhotos > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-warning-text">
              <Spinner size={14} />
              {t("saving")}
            </span>
          ) : saving ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Spinner size={14} /> {t("saving")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-success-text">
              <TickCircleIcon /> {t("saved")}
            </span>
          )}
          <Badge
            variant={outcome === "failed" ? "danger" : "success"}
            className="ms-2 hidden sm:inline-flex"
          >
            {outcome === "failed" ? t("willFail") : t("willPass")}
          </Badge>
        </div>
        <Button
          size="lg"
          onClick={() => void finish()}
          disabled={!editable || !!conflict || finishing}
        >
          {finishing ? <Spinner size={16} /> : <TickIcon />}
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
