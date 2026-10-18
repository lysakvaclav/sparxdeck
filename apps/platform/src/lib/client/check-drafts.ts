"use client";

import { draftIsEmpty, type CheckDraft } from "@/lib/field";

// What the server hasn't confirmed yet, kept in the phone (localStorage) so a
// closed tab, a dead battery or a lost signal doesn't lose it: each device's
// check (see CheckDraft) and actions like resolving a defect. Cleared once sent.

export type { CheckDraft } from "@/lib/field";

const PREFIX = "sparxdeck.check.";
const OPS_PREFIX = "sparxdeck.field.ops.";

export function draftKey(inspectionId: string, deviceId: string) {
  return `${PREFIX}${inspectionId}.${deviceId}`;
}

export function readDraft(key: string): CheckDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CheckDraft;
    return draft && typeof draft.answers === "object" ? draft : null;
  } catch {
    return null;
  }
}

/** Stores the draft, or removes it when nothing is left to send or show. */
export function writeDraft(key: string, draft: CheckDraft) {
  try {
    if (draftIsEmpty(draft)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the answer still goes straight to the server.
  }
}

/** Devices of an inspection with a draft in this phone. */
export function devicesWithDrafts(inspectionId: string): string[] {
  const prefix = `${PREFIX}${inspectionId}.`;
  const result: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix) && readDraft(key)) result.push(key.slice(prefix.length));
    }
  } catch {
    // No storage: nothing to report.
  }
  return result;
}

/** Inspections with drafts or queued actions in this phone. */
export function inspectionsWithDrafts(): string[] {
  const result = new Set<string>();
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) result.add(key.slice(PREFIX.length).split(".")[0]!);
      if (key?.startsWith(OPS_PREFIX)) result.add(key.slice(OPS_PREFIX.length));
    }
  } catch {
    // No storage: nothing kept.
  }
  return [...result];
}

// ---------------------------------------------------------------------------
// Live view of drafts for React (useSyncExternalStore): changes made through
// updateDraft, and in other tabs, re-render the components reading them.
// ---------------------------------------------------------------------------

const CHANGE_EVENT = "sparxdeck:check-draft";
const snapshots = new Map<string, { raw: string | null; value: CheckDraft | null }>();

export function subscribeDrafts(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

function notifyDrafts() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The same object for the same stored text, as useSyncExternalStore requires. */
export function draftSnapshot(key: string): CheckDraft | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = raw ? readDraft(key) : null;
  snapshots.set(key, { raw, value });
  return value;
}

export function updateDraft(key: string, change: (draft: CheckDraft) => CheckDraft) {
  writeDraft(key, change(readDraft(key) ?? { answers: {} }));
  notifyDrafts();
}

export function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  notifyDrafts();
}

/** Drops this phone's drafts and queued actions of an inspection. */
export function clearInspectionDrafts(inspectionId: string) {
  const prefix = `${PREFIX}${inspectionId}.`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
    localStorage.removeItem(`${OPS_PREFIX}${inspectionId}`);
  } catch {
    // No storage: nothing kept.
  }
  notifyDrafts();
}

// ---------------------------------------------------------------------------
// Queued actions besides checks (resolving a defect after a passed check)
// ---------------------------------------------------------------------------

export type FieldOp = { id: string; type: "resolve"; defectId: string; note: string };

export function readOps(inspectionId: string): FieldOp[] {
  try {
    const raw = localStorage.getItem(`${OPS_PREFIX}${inspectionId}`);
    const ops = raw ? (JSON.parse(raw) as FieldOp[]) : [];
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

function writeOps(inspectionId: string, ops: FieldOp[]) {
  try {
    const key = `${OPS_PREFIX}${inspectionId}`;
    if (ops.length) localStorage.setItem(key, JSON.stringify(ops));
    else localStorage.removeItem(key);
  } catch {
    // Storage full: the action is lost, as without a phone queue.
  }
  notifyDrafts();
}

export function queueOps(inspectionId: string, ops: FieldOp[]) {
  writeOps(inspectionId, [...readOps(inspectionId), ...ops]);
}

export function dropOp(inspectionId: string, id: string) {
  writeOps(
    inspectionId,
    readOps(inspectionId).filter((op) => op.id !== id),
  );
}

/** Text of an inspection's queued actions, for useSyncExternalStore. */
export function opsSnapshot(inspectionId: string): string {
  try {
    return localStorage.getItem(`${OPS_PREFIX}${inspectionId}`) ?? "";
  } catch {
    return "";
  }
}

/** Every draft and queued action of this phone (signing out). */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX) || key?.startsWith(OPS_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // No storage.
  }
  notifyDrafts();
}
