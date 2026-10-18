"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { databaseErrorCode, type ErrorCode } from "@/lib/errors";
import {
  answersPayload,
  draftPending,
  waitsForTechnician,
  type CheckConflict,
  type CheckDraft,
  type FieldPack,
} from "@/lib/field";
import type { AnswerDraft, Question } from "@/lib/inspections";
import type { CheckOutcome, Database } from "@/lib/supabase/database.types";
import {
  devicesWithDrafts,
  draftKey,
  dropOp,
  readDraft,
  readOps,
  updateDraft,
} from "./check-drafts";
import { queuedPhotoCounts, queuedPhotos, removePhoto } from "./photo-queue";

// Sending what the phone did to the server. Each device's check goes in three
// steps, each safe to repeat after a lost signal: claim it (and learn about a
// colleague's check meanwhile), upload its photos, submit everything at once.
// Nothing is dropped on a failure: without a signal, with an expired sign-in or
// a passing server error it waits for the next try; a refusal for good (device
// removed, …) waits for the technician.

type Client = SupabaseClient<Database>;
type RequestError = { message?: string; code?: string };

/**
 * How long a request may take. A weak signal can leave one hanging for minutes,
 * which would stall sending; every step is safe to repeat, so it is given up
 * and counted as no signal.
 */
const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** A signal that aborts a request after `ms` (reported as "TimeoutError", see isNetworkError). */
export function requestTimeout(ms = REQUEST_TIMEOUT_MS): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), ms);
  return controller.signal;
}

/** Storage uploads take no abort signal: stop waiting instead (a repeat finds the file). */
async function withinTime<T>(promise: Promise<T>, ms: number, timedOut: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => (timer = setTimeout(() => resolve(timedOut), ms))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Devices of an inspection with something in the phone: a draft or waiting photos. */
export async function devicesWithWork(inspectionId: string): Promise<string[]> {
  const photoCounts = await queuedPhotoCounts(inspectionId);
  return [...new Set([...devicesWithDrafts(inspectionId), ...Object.keys(photoCounts)])];
}

/** A failed request that never reached the server (no signal, airplane mode). */
export function isNetworkError(error: RequestError | null) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return !error.code && /fetch|network|load failed|timed? ?out|abort/i.test(error.message ?? "");
}

function isAuthError(error: RequestError) {
  return (
    error.code === "PGRST301" ||
    error.code === "PGRST302" ||
    /jwt|unauthori[sz]ed|not authenticated/i.test(error.message ?? "")
  );
}

/** Refusals that sending again won't change. */
const FINAL: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "notFound",
  "forbidden",
  "deviceInactive",
  "noTemplate",
  "checkIncomplete",
  "invalidAnswer",
  "inspectionClosed",
  "checkTakenOver",
  "tooManyPhotos",
]);

export type Failure =
  { kind: "offline" } | { kind: "auth" } | { kind: "retry" } | { kind: "error"; error: ErrorCode };

export function failureOf(error: RequestError): Failure {
  if (isNetworkError(error)) return { kind: "offline" };
  if (isAuthError(error)) return { kind: "auth" };
  const code = databaseErrorCode(error);
  return FINAL.has(code) ? { kind: "error", error: code } : { kind: "retry" };
}

export type Claim =
  | { kind: "held"; item: string; template: string }
  | { kind: "busy"; item: string; name: string }
  | { kind: "conflict"; item: string; conflict: CheckConflict }
  | Failure;

export async function claimCheck(
  supabase: Client,
  args: {
    inspectionId: string;
    deviceId: string;
    templateId: string | null;
    seen: string | null;
    takeOver: boolean;
  },
): Promise<Claim> {
  const { data, error } = await supabase
    .rpc("claim_device_check", {
      p_inspection: args.inspectionId,
      p_device: args.deviceId,
      p_template: args.templateId,
      p_seen: args.seen,
      p_take_over: args.takeOver,
    })
    .abortSignal(requestTimeout());
  if (error) return failureOf(error);
  const result = data as {
    item: string;
    template?: string;
    heldBy?: string;
    conflict?: CheckConflict;
  };
  if (result.conflict) return { kind: "conflict", item: result.item, conflict: result.conflict };
  if (result.heldBy) return { kind: "busy", item: result.item, name: result.heldBy };
  return { kind: "held", item: result.item, template: result.template ?? "" };
}

export type Sent = { kind: "ok" } | Failure;

/** Uploads the device's waiting photos to the check the phone holds. */
export async function uploadQueuedPhotos(
  supabase: Client,
  args: {
    organizationId: string;
    inspectionId: string;
    deviceId: string;
    item: string;
    onUploading?: (photoId: string) => void;
    onUploaded?: (photoId: string, stored: { photoId: string | null; path: string }) => void;
    onWaiting?: (photoId: string) => void;
  },
): Promise<Sent> {
  for (const photo of await queuedPhotos(args.inspectionId, args.deviceId)) {
    args.onUploading?.(photo.id);
    const path = `${args.organizationId}/inspections/${args.inspectionId}/${args.item}/${photo.id}.jpg`;
    const upload = await withinTime<{ error: { message: string } | null }>(
      supabase.storage
        .from("org-assets")
        .upload(path, photo.blob, { contentType: "image/jpeg", upsert: false }),
      UPLOAD_TIMEOUT_MS,
      { error: { message: "Upload timed out" } },
    );
    // Uploaded before but not registered (signal lost in between): carry on.
    if (upload.error && !/exist|duplicate/i.test(upload.error.message)) {
      args.onWaiting?.(photo.id);
      const failure = failureOf({ message: upload.error.message });
      return failure.kind === "error" ? { kind: "retry" } : failure;
    }
    const { data: photoId, error } = await supabase
      .rpc("add_inspection_photo", {
        p_item: args.item,
        p_template_item: photo.questionId,
        p_path: path,
        p_content_type: "image/jpeg",
        p_size: photo.blob.size,
      })
      .abortSignal(requestTimeout());
    if (error && error.code !== "23505") {
      const failure = failureOf(error);
      // Over the limit of photos per check: this one can't be added, the rest goes on.
      if (failure.kind === "error" && failure.error === "tooManyPhotos") {
        await removePhoto(photo.id);
        await supabase.storage.from("org-assets").remove([path]);
        continue;
      }
      args.onWaiting?.(photo.id);
      return failure;
    }
    await removePhoto(photo.id);
    args.onUploaded?.(photo.id, { photoId: photoId ?? null, path });
  }
  return { kind: "ok" };
}

export type Submitted =
  { kind: "ok"; outcome: CheckOutcome | null; checkedAt: string | null } | Failure;

/** Sends the draft's answers, note and action to the check the phone holds. */
export async function submitCheck(
  supabase: Client,
  args: { item: string; questions: readonly Question[]; draft: CheckDraft; release: boolean },
): Promise<Submitted> {
  const { draft } = args;
  const { data, error } = await supabase
    .rpc("submit_device_check", {
      p_item: args.item,
      p_answers: answersPayload(args.questions, draft.answers),
      p_notes: draft.notes ?? null,
      p_set_notes: draft.notes !== undefined,
      p_action: draft.action?.type ?? "save",
      p_skip_reason: draft.action?.type === "skip" ? draft.action.reason : null,
      p_checked_at: draft.checkedAt ?? null,
      // After a conflict, the phone's check replaces the colleague's answers.
      p_replace: !!draft.force && !!draft.action,
      p_release: args.release,
    })
    .abortSignal(requestTimeout());
  if (error) return failureOf(error);
  const result = data as { outcome: CheckOutcome | null; checkedAt: string | null };
  return { kind: "ok", outcome: result.outcome, checkedAt: result.checkedAt };
}

const sameAnswer = (a: AnswerDraft | undefined, b: AnswerDraft) =>
  !!a &&
  a.pass === b.pass &&
  a.number === b.number &&
  a.text === b.text &&
  a.note === b.note &&
  (a.severity ?? null) === (b.severity ?? null);

/**
 * Removes from the draft what the server confirmed; changes made while it was
 * being sent stay for the next pass.
 */
export function settleDraft(key: string, sent: CheckDraft, questions: readonly Question[]) {
  const sentIds = new Set(Object.keys(answersPayload(questions, sent.answers)));
  updateDraft(key, (draft) => {
    const answers: Record<string, AnswerDraft> = {};
    for (const [id, answer] of Object.entries(draft.answers)) {
      const confirmed = sentIds.has(id) && sameAnswer(sent.answers[id], answer);
      if (!confirmed) answers[id] = answer;
    }
    const actionSent = JSON.stringify(draft.action) === JSON.stringify(sent.action);
    return {
      ...draft,
      answers,
      notes: draft.notes === sent.notes ? undefined : draft.notes,
      action: actionSent ? undefined : draft.action,
      checkedAt: actionSent ? undefined : draft.checkedAt,
      force: actionSent ? undefined : draft.force,
      conflict: undefined,
      heldBy: undefined,
      error: undefined,
    };
  });
}

/** What happened to a device's check in a sync pass. */
export type DeviceSync =
  | {
      kind: "synced";
      item: string;
      template: string;
      sent: CheckDraft | null;
      outcome: CheckOutcome | null;
      checkedAt: string | null;
    }
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "closed" }
  | { kind: "offline" }
  | { kind: "auth" }
  | { kind: "retry" };

/** A refusal for good: kept on the draft for the technician; closes on a closed inspection. */
function refused(key: string, error: ErrorCode): DeviceSync {
  if (error === "inspectionClosed") return { kind: "closed" };
  // Taken over between the steps: the next pass sees who has it.
  if (error !== "checkTakenOver") updateDraft(key, (d) => ({ ...d, error }));
  return { kind: "waiting" };
}

/** Sends one device's check from the phone (not the one open on screen). */
export async function syncDevice(
  supabase: Client,
  pack: FieldPack,
  deviceId: string,
): Promise<DeviceSync> {
  const inspectionId = pack.inspection.id;
  const key = draftKey(inspectionId, deviceId);
  const draft = readDraft(key);
  const photos = await queuedPhotos(inspectionId, deviceId);
  if (!draftPending(draft) && photos.length === 0) return { kind: "idle" };
  if (waitsForTechnician(draft)) return { kind: "waiting" };

  const item = pack.items[deviceId];
  const answered = !!draft && (Object.keys(draft.answers).length > 0 || !!draft.action);
  const claim = await claimCheck(supabase, {
    inspectionId,
    deviceId,
    templateId: answered ? (draft?.templateId ?? null) : null,
    seen: draft && "seen" in draft ? (draft.seen ?? null) : (item?.checkedAt ?? null),
    takeOver: !!draft?.force,
  });
  if (claim.kind === "error") return refused(key, claim.error);
  if (claim.kind === "offline" || claim.kind === "auth" || claim.kind === "retry") return claim;
  if (claim.kind === "busy") {
    updateDraft(key, (d) => ({ ...d, heldBy: claim.name }));
    return { kind: "waiting" };
  }
  if (claim.kind === "conflict") {
    updateDraft(key, (d) => ({ ...d, conflict: claim.conflict, heldBy: undefined }));
    return { kind: "waiting" };
  }

  const uploaded = await uploadQueuedPhotos(supabase, {
    organizationId: pack.organizationId,
    inspectionId,
    deviceId,
    item: claim.item,
  });
  if (uploaded.kind === "error") return refused(key, uploaded.error);
  if (uploaded.kind !== "ok") return uploaded;

  const current = readDraft(key);
  const questions = pack.templates[claim.template] ?? [];
  if (!draftPending(current)) {
    // Only photos were waiting: let go of the check.
    await supabase
      .rpc("release_device_check", { p_item: claim.item })
      .abortSignal(requestTimeout());
    return {
      kind: "synced",
      item: claim.item,
      template: claim.template,
      sent: null,
      outcome: null,
      checkedAt: null,
    };
  }
  const submitted = await submitCheck(supabase, {
    item: claim.item,
    questions,
    draft: current!,
    release: true,
  });
  if (submitted.kind === "error") return refused(key, submitted.error);
  if (submitted.kind !== "ok") return submitted;
  settleDraft(key, current!, questions);
  return {
    kind: "synced",
    item: claim.item,
    template: claim.template,
    sent: current,
    outcome: submitted.outcome,
    checkedAt: submitted.checkedAt,
  };
}

export type InspectionSync = {
  /** Devices whose checks reached the server, with what was sent. */
  synced: Record<string, Extract<DeviceSync, { kind: "synced" }>>;
  /** Why the pass stopped early, if it did. */
  stopped: "offline" | "auth" | "retry" | "closed" | null;
  /** Queued actions the server refused (e.g. a defect deleted meanwhile). */
  refused: number;
};

/**
 * One pass over everything an inspection has waiting in the phone, except the
 * device open on screen (its check sends its own changes). Devices no longer in
 * the pack are sent too: the server saves the check or refuses it for the
 * technician to see. Stops at the first sign of no signal; a passing server
 * error on one device lets the others go on.
 */
export async function syncInspection(
  supabase: Client,
  pack: FieldPack,
  skipDevice: string | null,
): Promise<InspectionSync> {
  const inspectionId = pack.inspection.id;
  const result: InspectionSync = { synced: {}, stopped: null, refused: 0 };
  let retry = false;
  for (const deviceId of await devicesWithWork(inspectionId)) {
    if (deviceId === skipDevice) continue;
    const outcome = await syncDevice(supabase, pack, deviceId);
    if (outcome.kind === "offline" || outcome.kind === "auth" || outcome.kind === "closed")
      return { ...result, stopped: outcome.kind };
    if (outcome.kind === "retry") retry = true;
    if (outcome.kind === "synced") result.synced[deviceId] = outcome;
  }
  for (const op of readOps(inspectionId)) {
    const { error } = await supabase
      .rpc("change_defect_status", {
        p_defect: op.defectId,
        p_status: "resolved",
        p_note: op.note,
      })
      .abortSignal(requestTimeout());
    if (error) {
      const failure = failureOf(error);
      if (failure.kind === "offline" || failure.kind === "auth")
        return { ...result, stopped: failure.kind };
      if (failure.kind === "retry") {
        retry = true;
        continue;
      }
      result.refused++;
    }
    dropOp(inspectionId, op.id);
  }
  return { ...result, stopped: retry ? "retry" : null };
}
