import type { DeviceTypeField } from "@/lib/devices";
import {
  answerPayload,
  isAnswered,
  missingRequired,
  outcomeOf,
  parseNumber,
  type AnswerDraft,
  type Question,
} from "@/lib/inspections";
import type { ScanCapture } from "@/lib/scan-location";
import type {
  CheckOutcome,
  CheckSkipReason,
  DefectSeverity,
  Json,
  ScanLocationError,
  ScanLocationState,
} from "@/lib/supabase/database.types";

// An inspection in the field: everything the phone needs to do it without a
// signal (the "pack", downloaded while online and kept in the phone), and the
// rules that combine it with what the phone hasn't sent yet. Pure functions,
// shared by the server (which builds the pack) and the phone.

export type FieldDevice = {
  id: string;
  number: string;
  labelNumber: number;
  token: string;
  typeId: string;
  typeName: string;
  locationName: string | null;
  serialNumber: string | null;
  lastInspectionOn: string | null;
};

/** A photo already on the server (its signed link may have expired offline). */
export type FieldPhoto = { id: string; questionId: string | null; path: string; url: string };

/** The server's state of a device's check when the pack was made. */
export type FieldItem = {
  id: string;
  templateId: string;
  outcome: CheckOutcome | null;
  skipReason: CheckSkipReason | null;
  notes: string;
  /** A colleague filling it in right now (not the current user). */
  heldBy: string | null;
  checkedBy: string | null;
  checkedById: string | null;
  /** Exactly as the database has it: sent back to tell a colleague's later check. */
  checkedAt: string | null;
  answers: Record<string, AnswerDraft>;
  photos: FieldPhoto[];
  /** Where the device was scanned, as the server judged it (absent in older packs). */
  location?: FieldLocationResult | null;
};

/** The server's verdict on the position of a device's scan. */
export type FieldLocationResult = {
  /** Null: not scanned in this check. */
  state: ScanLocationState | null;
  distanceM: number | null;
  error: ScanLocationError | null;
  note: string | null;
};

/** An unresolved defect of the device; a "no" to its question is added to it. */
export type OpenDefect = {
  id: string;
  number: number;
  description: string;
  severity: DefectSeverity;
  question: string | null;
};

export type FieldPlan = {
  id: string;
  name: string;
  width: number;
  height: number;
  imagePath: string;
  /** A short-lived signed link to download the image into the phone. */
  imageUrl: string;
};

export type FieldDeviceType = {
  id: string;
  name: string;
  code: string;
  customFields: DeviceTypeField[];
};
export type FieldLocation = { id: string; name: string };

/** A device that left the inspection while the phone had work for it (see mergePack). */
export type GoneDevice = { id: string; number: string };

export type FieldPack = {
  version: 1;
  /** When the server made it (newer packs replace older ones in the phone). */
  fetchedAt: string;
  userId: string;
  /** The signed-in member's name (shown on checks this phone sends). */
  userName: string;
  organizationId: string;
  inspection: {
    id: string;
    status: "in_progress" | "completed";
    siteId: string;
    siteName: string;
    customerId: string | null;
    customerName: string | null;
    accessNotes: string | null;
    canCancel: boolean;
    /** A completed inspection reopened for a correction (absent in older packs). */
    correction?: boolean;
    /** The building has a point to compare scans with (absent in older packs). */
    sitePoint?: boolean;
  };
  /** Active devices in route order. */
  devices: FieldDevice[];
  items: Record<string, FieldItem>;
  /** Questions of every checklist version the inspection may use. */
  templates: Record<string, Question[]>;
  /** The active checklist version by device type. */
  activeTemplates: Record<string, string>;
  defects: Record<string, OpenDefect[]>;
  plans: FieldPlan[];
  placements: Record<string, { planId: string; x: number; y: number }>;
  /** For adding a device found on site (online only). */
  types: FieldDeviceType[];
  locations: FieldLocation[];
  /** Kept by the phone, not sent by the server. */
  gone?: GoneDevice[];
  /** The company records the position of scans (absent in older packs: no). */
  scanLocation?: boolean;
};

/** What a colleague did meanwhile, as claim_device_check reports it. */
export type CheckConflict = {
  name: string;
  outcome: CheckOutcome | null;
  skipReason: CheckSkipReason | null;
  checkedAt: string | null;
};

/**
 * What the phone keeps for a device until the server confirms it (localStorage):
 * changed answers, the device note, and once the technician is done the action
 * with the time it was done. Conflicts and errors wait here for the technician.
 */
export type CheckDraft = {
  /** Unsent answers by question id; once done, the whole check. */
  answers: Record<string, AnswerDraft>;
  /** Unsent note on the whole device. */
  notes?: string;
  action?: { type: "finish" } | { type: "skip"; reason: CheckSkipReason };
  /** When "Done" or "Can't check" was pressed (the check's time, not the sending's). */
  checkedAt?: string;
  /** The check's checked_at when this phone started: a later one is a colleague's. */
  seen?: string | null;
  /** The checklist version answered. */
  templateId?: string;
  /** Replace a colleague's check (the technician chose to after a conflict). */
  force?: boolean;
  conflict?: CheckConflict;
  /** A colleague is filling it in: sending waits for them. */
  heldBy?: string;
  /** The server refused it for good (device removed, …): shown until discarded. */
  error?: string;
  /** The position at the device's latest scan, until the server has it. */
  scan?: ScanCapture;
};

/** Nothing left to send or to show: the draft can go. */
export function draftIsEmpty(draft: CheckDraft): boolean {
  return (
    Object.keys(draft.answers).length === 0 &&
    draft.notes === undefined &&
    !draft.action &&
    !draft.conflict &&
    !draft.error &&
    !draft.scan
  );
}

/**
 * A scan's position waits to be sent. Kept apart from draftPending: a position
 * alone doesn't make a finished check "open" again.
 */
export function scanPending(draft: CheckDraft | null | undefined): boolean {
  return !!draft?.scan;
}

/** Something waits to be sent (conflicts and errors wait for the technician instead). */
export function draftPending(draft: CheckDraft | null | undefined): boolean {
  if (!draft) return false;
  return Object.keys(draft.answers).length > 0 || draft.notes !== undefined || !!draft.action;
}

/** Waits for the technician, not for a signal: a conflict to decide or a refusal to read. */
export function waitsForTechnician(draft: CheckDraft | null | undefined): boolean {
  return !!draft && ((!!draft.conflict && !draft.force) || !!draft.error);
}

/** What waits in the phone for an inspection. */
export type FieldTally = {
  /** Checks the phone sends by itself. */
  checks: number;
  /** Photos the phone sends by itself. */
  photos: number;
  /** Devices waiting for the technician (their photos wait with them). */
  decide: string[];
  /** Devices with work in the phone that are no longer in the inspection. */
  gone: { id: string; number: string | null }[];
};

export function fieldTally(
  pack: FieldPack,
  drafts: Readonly<Record<string, CheckDraft | null | undefined>>,
  photoCounts: Readonly<Record<string, number>>,
): FieldTally {
  const ids = [
    ...new Set([
      ...Object.keys(drafts).filter((id) => drafts[id]),
      ...Object.keys(photoCounts).filter((id) => (photoCounts[id] ?? 0) > 0),
    ]),
  ];
  const present = new Set(pack.devices.map((device) => device.id));
  const known = new Map((pack.gone ?? []).map((device) => [device.id, device.number]));
  const tally: FieldTally = { checks: 0, photos: 0, decide: [], gone: [] };
  for (const id of ids) {
    const draft = drafts[id];
    if (!present.has(id)) tally.gone.push({ id, number: known.get(id) ?? null });
    if (waitsForTechnician(draft)) {
      tally.decide.push(id);
      continue;
    }
    if (draftPending(draft)) tally.checks++;
    tally.photos += photoCounts[id] ?? 0;
  }
  return tally;
}

/** The checklist version a device's check uses on this phone. */
export function templateOf(
  pack: FieldPack,
  device: FieldDevice,
  draft?: CheckDraft | null,
): string | null {
  return (
    draft?.templateId ??
    pack.items[device.id]?.templateId ??
    pack.activeTemplates[device.typeId] ??
    null
  );
}

export type FieldState = "passed" | "failed" | "skipped" | "open" | "held" | "remaining";

export type DeviceView = {
  state: FieldState;
  skipReason: CheckSkipReason | null;
  /** Done in the phone, not on the server yet. */
  pending: boolean;
  conflict: CheckConflict | null;
  error: string | null;
  /** A colleague's name: filling it in now. */
  heldBy: string | null;
  checkedBy: string | null;
  /** The position of the device's scan: "waiting" until the phone has sent it. */
  location: ScanLocationState | "waiting" | null;
  /** The technician's or a manager's explanation of the position. */
  locationNote: string | null;
};

/** A device's state in the phone: the server's, with what the phone hasn't sent on top. */
export function deviceView(
  pack: FieldPack,
  device: FieldDevice,
  draft: CheckDraft | null | undefined,
): DeviceView {
  const item = pack.items[device.id];
  const base = {
    conflict: draft?.conflict ?? null,
    error: draft?.error ?? null,
    heldBy: draft?.heldBy ?? item?.heldBy ?? null,
    checkedBy: item?.checkedBy ?? null,
    location: draft?.scan ? ("waiting" as const) : (item?.location?.state ?? null),
    locationNote: item?.location?.note ?? null,
  };
  if (draft?.action?.type === "skip")
    return { ...base, state: "skipped", skipReason: draft.action.reason, pending: true };
  if (draft?.action?.type === "finish") {
    const template = templateOf(pack, device, draft);
    const questions = (template && pack.templates[template]) || [];
    const answers = { ...item?.answers, ...draft.answers };
    return { ...base, state: outcomeOf(questions, answers), skipReason: null, pending: true };
  }
  if (draftPending(draft)) return { ...base, state: "open", skipReason: null, pending: true };
  if (item?.outcome === "passed" || item?.outcome === "failed")
    return { ...base, state: item.outcome, skipReason: null, pending: false };
  if (item?.skipReason)
    return { ...base, state: "skipped", skipReason: item.skipReason, pending: false };
  if (base.heldBy) return { ...base, state: "held", skipReason: null, pending: false };
  return { ...base, state: item ? "open" : "remaining", skipReason: null, pending: false };
}

/** Handled: checked, or left out with a reason. */
export function isHandled(view: DeviceView): boolean {
  return view.state === "passed" || view.state === "failed" || view.state === "skipped";
}

/**
 * Answers as submit_device_check takes them. Numbers still being typed (not a
 * number yet) stay in the phone.
 */
export function answersPayload(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerDraft>>,
): Record<string, Json> {
  const result: Record<string, Json> = {};
  for (const [id, answer] of Object.entries(answers)) {
    const question = questions.find((q) => q.id === id);
    if (!question) continue;
    if (question.type === "number" && Number.isNaN(parseNumber(answer.number))) continue;
    const payload = answerPayload(question, answer);
    result[id] = {
      pass: payload.p_value_pass,
      number: payload.p_value_number,
      text: payload.p_value_text,
      note: payload.p_note,
      severity: payload.p_defect_severity,
    };
  }
  return result;
}

/**
 * The whole check as the phone has it: the server's answers with the phone's
 * changes, for the questions of the version answered.
 */
export function fullAnswers(
  questions: readonly Question[],
  base: Readonly<Record<string, AnswerDraft>>,
  changes: Readonly<Record<string, AnswerDraft>>,
): Record<string, AnswerDraft> {
  const result: Record<string, AnswerDraft> = {};
  for (const question of questions) {
    const answer = changes[question.id] ?? base[question.id];
    if (answer) result[question.id] = answer;
  }
  return result;
}

/** Ready to be done on the phone: every required question answered. */
export function readyToFinish(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerDraft>>,
): boolean {
  return missingRequired(questions, answers).length === 0;
}

/** Questions answered so far (for "3 of 5" hints). */
export function answeredCount(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerDraft>>,
): number {
  return questions.filter((question) => isAnswered(question, answers[question.id])).length;
}

/** What a sync pass sent for a device and what the server answered. */
export type SyncedCheck = {
  item: string;
  template: string;
  sent: CheckDraft | null;
  outcome: CheckOutcome | null;
  checkedAt: string | null;
  /** The server's verdict on a scan's position sent in the same pass. */
  location?: FieldLocationResult;
};

/**
 * The pack with a device's check as the server now has it after the phone sent
 * it, so the phone shows it right away (the next pack confirms it).
 */
export function applySynced(pack: FieldPack, deviceId: string, synced: SyncedCheck): FieldPack {
  const previous = pack.items[deviceId];
  const sent = synced.sent;
  const done = synced.outcome !== null;
  // Only photos sent: the check itself is as it was.
  const kept = !done && !sent;
  const item: FieldItem = {
    id: synced.item,
    templateId: synced.template || previous?.templateId || "",
    outcome: done ? synced.outcome : kept ? (previous?.outcome ?? null) : null,
    skipReason:
      sent?.action?.type === "skip"
        ? sent.action.reason
        : kept
          ? (previous?.skipReason ?? null)
          : null,
    notes: sent?.notes ?? previous?.notes ?? "",
    heldBy: null,
    checkedBy: done ? pack.userName : kept ? (previous?.checkedBy ?? null) : null,
    checkedById: done ? pack.userId : kept ? (previous?.checkedById ?? null) : null,
    checkedAt: done ? synced.checkedAt : kept ? (previous?.checkedAt ?? null) : null,
    // After a conflict the phone's check replaced the colleague's answers.
    answers:
      sent?.force && sent.action ? { ...sent.answers } : { ...previous?.answers, ...sent?.answers },
    photos: previous?.photos ?? [],
    location: synced.location ?? previous?.location ?? null,
  };
  return { ...pack, items: { ...pack.items, [deviceId]: item } };
}

/**
 * A newer pack from the server, keeping checklist versions the phone may still
 * send, the checks the phone sent after the server made the pack (`keep`), and
 * the labels of devices that left the inspection meanwhile (removed,
 * decommissioned, moved) while the phone still has work for them (`pending`),
 * so the technician knows which changes can't be saved.
 */
export function mergePack(
  previous: FieldPack | null,
  next: FieldPack,
  keep: readonly string[] = [],
  pending: readonly string[] = [],
): FieldPack {
  if (!previous) return next;
  const items = { ...next.items };
  for (const id of keep) {
    const item = previous.items[id];
    if (item) items[id] = item;
  }
  const present = new Set(next.devices.map((device) => device.id));
  const gone = new Map<string, GoneDevice>();
  for (const device of [...(next.gone ?? []), ...(previous.gone ?? []), ...previous.devices])
    if (pending.includes(device.id) && !present.has(device.id) && !gone.has(device.id))
      gone.set(device.id, { id: device.id, number: device.number });
  return {
    ...next,
    items,
    templates: { ...previous.templates, ...next.templates },
    gone: [...gone.values()],
  };
}

/** Pack A is newer than pack B (null counts as oldest). */
export function newerPack(a: FieldPack | null, b: FieldPack | null): FieldPack | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.fetchedAt) >= Date.parse(b.fetchedAt) ? a : b;
}
