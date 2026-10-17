"use client";

import type { AnswerDraft } from "@/lib/inspections";

// Answers the server hasn't confirmed yet, kept in the phone (localStorage) so a
// closed tab, a dead battery or a lost signal doesn't lose them. Cleared once sent.

const PREFIX = "sparxdeck.check.";

export type CheckDraft = {
  /** Unsent answers by question id. */
  answers: Record<string, AnswerDraft>;
  /** Unsent note on the whole device. */
  notes?: string;
};

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

/** Stores the draft, or removes it when nothing is left to send. */
export function writeDraft(key: string, draft: CheckDraft) {
  try {
    const empty = Object.keys(draft.answers).length === 0 && draft.notes === undefined;
    if (empty) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the answer still goes straight to the server.
  }
}

/** Devices of an inspection with unsent answers in this phone. */
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

// ---------------------------------------------------------------------------
// Live view of a draft for React (useSyncExternalStore): changes made through
// updateDraft, and in other tabs, re-render the components reading it.
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
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Drops this phone's unsent answers of an inspection (it was cancelled). */
export function clearInspectionDrafts(inspectionId: string) {
  const prefix = `${PREFIX}${inspectionId}.`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // No storage: nothing kept.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
