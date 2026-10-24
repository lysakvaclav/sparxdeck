import { describe, expect, it } from "vitest";
import {
  answersPayload,
  applySynced,
  deviceView,
  draftIsEmpty,
  draftPending,
  fieldTally,
  fullAnswers,
  isHandled,
  mergePack,
  newerPack,
  templateOf,
  type CheckDraft,
  type FieldItem,
  type FieldPack,
} from "@/lib/field";
import { EMPTY_ANSWER, type AnswerDraft, type Question } from "@/lib/inspections";

const questions: Question[] = [
  {
    id: "q1",
    label: "Plomba",
    type: "pass_fail",
    required: true,
    failCreatesDefect: true,
    photoRequired: false,
  },
  {
    id: "q2",
    label: "Tlak",
    type: "number",
    required: true,
    failCreatesDefect: false,
    photoRequired: false,
  },
  {
    id: "q3",
    label: "Poznámka",
    type: "text",
    required: false,
    failCreatesDefect: false,
    photoRequired: false,
  },
];

const answer = (patch: Partial<AnswerDraft>): AnswerDraft => ({ ...EMPTY_ANSWER, ...patch });

const item = (patch: Partial<FieldItem> = {}): FieldItem => ({
  id: "item-1",
  templateId: "t1",
  outcome: null,
  skipReason: null,
  notes: "",
  heldBy: null,
  checkedBy: null,
  checkedById: null,
  checkedAt: null,
  answers: {},
  photos: [],
  ...patch,
});

const device = {
  id: "d1",
  number: "0001",
  labelNumber: 1,
  token: "TOKEN",
  typeId: "type-1",
  typeName: "Hasicí přístroj",
  locationName: null,
  serialNumber: null,
  lastInspectionOn: null,
};

const pack = (items: Record<string, FieldItem> = {}): FieldPack => ({
  version: 1,
  fetchedAt: "2026-10-17T08:00:00.000Z",
  userId: "me",
  userName: "Tomáš Technik",
  organizationId: "org",
  inspection: {
    id: "insp",
    status: "in_progress",
    siteId: "site",
    siteName: "Lipová 12",
    customerId: null,
    customerName: null,
    accessNotes: null,
    canCancel: true,
  },
  devices: [device],
  items,
  templates: { t1: questions, t2: questions.slice(0, 1) },
  activeTemplates: { "type-1": "t2" },
  defects: {},
  plans: [],
  placements: {},
  types: [],
  locations: [],
});

describe("drafts in the phone", () => {
  it("are empty with nothing to send or show, pending with something to send", () => {
    expect(draftIsEmpty({ answers: {}, seen: null, templateId: "t1" })).toBe(true);
    expect(
      draftIsEmpty({
        answers: {},
        conflict: { name: "J", outcome: null, skipReason: null, checkedAt: null },
      }),
    ).toBe(false);
    expect(draftPending({ answers: {}, notes: "" })).toBe(true);
    expect(draftPending({ answers: {}, action: { type: "finish" } })).toBe(true);
    expect(draftPending({ answers: {}, error: "notFound" })).toBe(false);
    expect(draftPending(null)).toBe(false);
  });

  it("use the version answered, else the check's, else the type's active one", () => {
    expect(templateOf(pack(), device, null)).toBe("t2");
    expect(templateOf(pack({ d1: item() }), device, null)).toBe("t1");
    expect(templateOf(pack({ d1: item() }), device, { answers: {}, templateId: "t9" })).toBe("t9");
  });
});

describe("a device's state in the phone", () => {
  it("is the server's when nothing waits in the phone", () => {
    expect(deviceView(pack(), device, null)).toMatchObject({ state: "remaining", pending: false });
    expect(deviceView(pack({ d1: item() }), device, null).state).toBe("open");
    expect(deviceView(pack({ d1: item({ heldBy: "Jana" }) }), device, null)).toMatchObject({
      state: "held",
      heldBy: "Jana",
    });
    expect(deviceView(pack({ d1: item({ outcome: "failed" }) }), device, null).state).toBe(
      "failed",
    );
    const skipped = deviceView(
      pack({ d1: item({ outcome: "not_checked", skipReason: "missing" }) }),
      device,
      null,
    );
    expect(skipped).toMatchObject({ state: "skipped", skipReason: "missing" });
    expect(isHandled(skipped)).toBe(true);
  });

  it("shows what was done in the phone on top, with the outcome its answers give", () => {
    const failed: CheckDraft = {
      answers: { q1: answer({ pass: false }) },
      action: { type: "finish" },
      templateId: "t1",
    };
    expect(deviceView(pack({ d1: item({ outcome: "passed" }) }), device, failed)).toMatchObject({
      state: "failed",
      pending: true,
    });
    const skip: CheckDraft = { answers: {}, action: { type: "skip", reason: "inaccessible" } };
    expect(deviceView(pack(), device, skip)).toMatchObject({
      state: "skipped",
      skipReason: "inaccessible",
      pending: true,
    });
    const started: CheckDraft = { answers: { q1: answer({ pass: true }) } };
    expect(deviceView(pack(), device, started)).toMatchObject({ state: "open", pending: true });
    expect(isHandled(deviceView(pack(), device, started))).toBe(false);
  });

  it("carries a conflict and a refusal for the technician", () => {
    const conflict = {
      name: "Petra",
      outcome: "passed" as const,
      skipReason: null,
      checkedAt: "x",
    };
    const view = deviceView(pack(), device, {
      answers: {},
      action: { type: "finish" },
      conflict,
      error: "notFound",
    });
    expect(view.conflict).toEqual(conflict);
    expect(view.error).toBe("notFound");
  });
});

describe("sending a check", () => {
  it("sends answers by question, keeping a number still being typed in the phone", () => {
    expect(
      answersPayload(questions, {
        q1: answer({ pass: false, severity: "critical", note: " chybí " }),
        q2: answer({ number: "12,5" }),
        q3: answer({ text: "  " }),
        unknown: answer({ pass: true }),
      }),
    ).toEqual({
      q1: { pass: false, number: null, text: null, note: "chybí", severity: "critical" },
      q2: { pass: null, number: 12.5, text: null, note: null, severity: null },
      q3: { pass: null, number: null, text: null, note: null, severity: null },
    });
    expect(answersPayload(questions, { q2: answer({ number: "12," }) })).toEqual({});
  });

  it("the whole check is the server's answers with the phone's changes, for its questions", () => {
    expect(
      fullAnswers(
        questions,
        { q1: answer({ pass: true }), q2: answer({ number: "3" }), old: answer({ pass: true }) },
        { q1: answer({ pass: false }) },
      ),
    ).toEqual({ q1: answer({ pass: false }), q2: answer({ number: "3" }) });
  });
});

describe("after sending", () => {
  const finished: CheckDraft = {
    answers: { q1: answer({ pass: true }) },
    action: { type: "finish" },
    notes: "OK",
  };

  it("shows the check as the server now has it, signed by this phone's user", () => {
    const next = applySynced(pack(), "d1", {
      item: "item-9",
      template: "t1",
      sent: finished,
      outcome: "passed",
      checkedAt: "2026-10-17T09:00:00.123456+00:00",
    });
    expect(next.items.d1).toMatchObject({
      id: "item-9",
      outcome: "passed",
      checkedBy: "Tomáš Technik",
      checkedById: "me",
      checkedAt: "2026-10-17T09:00:00.123456+00:00",
      notes: "OK",
      answers: { q1: answer({ pass: true }) },
    });
  });

  it("a saved, unfinished check is open; sent photos alone leave the check as it was", () => {
    const base = pack({ d1: item({ outcome: "passed", checkedAt: "t", checkedBy: "Jana" }) });
    const saved = applySynced(base, "d1", {
      item: "item-1",
      template: "t1",
      sent: { answers: { q1: answer({ pass: false }) } },
      outcome: null,
      checkedAt: null,
    });
    expect(saved.items.d1).toMatchObject({ outcome: null, checkedAt: null, checkedBy: null });
    const photos = applySynced(base, "d1", {
      item: "item-1",
      template: "t1",
      sent: null,
      outcome: null,
      checkedAt: null,
    });
    expect(photos.items.d1).toMatchObject({ outcome: "passed", checkedAt: "t", checkedBy: "Jana" });
  });

  it("after a conflict the phone's answers replace the colleague's", () => {
    const base = pack({
      d1: item({ answers: { q1: answer({ pass: false }), q2: answer({ number: "1" }) } }),
    });
    const next = applySynced(base, "d1", {
      item: "item-1",
      template: "t1",
      sent: { ...finished, force: true },
      outcome: "passed",
      checkedAt: "t",
    });
    expect(next.items.d1?.answers).toEqual({ q1: answer({ pass: true }) });
  });
});

describe("a newer pack", () => {
  it("replaces the phone's, but not the checks sent after the server made it", () => {
    const mine = pack({ d1: item({ outcome: "passed" }) });
    const server = { ...pack({ d1: item() }), fetchedAt: "2026-10-17T09:00:00.000Z" };
    server.templates = { t2: [] };
    expect(mergePack(mine, server).items.d1?.outcome).toBeNull();
    const kept = mergePack(mine, server, ["d1"]);
    expect(kept.items.d1?.outcome).toBe("passed");
    // Checklist versions the phone may still send stay.
    expect(Object.keys(kept.templates).sort()).toEqual(["t1", "t2"]);
    expect(kept.templates.t2).toEqual([]);
  });

  it("is the one made later", () => {
    const old = pack();
    const fresh = { ...pack(), fetchedAt: "2026-10-18T08:00:00.000Z" };
    expect(newerPack(old, fresh)).toBe(fresh);
    expect(newerPack(fresh, old)).toBe(fresh);
    expect(newerPack(null, old)).toBe(old);
  });

  it("keeps the label of a device that left while the phone has work for it", () => {
    const mine = pack();
    const server = { ...pack(), devices: [] };
    // Nothing waits for it: it just goes.
    expect(mergePack(mine, server).gone).toEqual([]);
    const next = mergePack(mine, server, [], ["d1"]);
    expect(next.gone).toEqual([{ id: "d1", number: "0001" }]);
    // Carried on through later packs, once, until nothing waits; back in the inspection, not gone.
    expect(mergePack(next, { ...server, gone: next.gone }, [], ["d1"]).gone).toEqual([
      { id: "d1", number: "0001" },
    ]);
    expect(mergePack(next, server, [], []).gone).toEqual([]);
    expect(mergePack(next, pack(), [], ["d1"]).gone).toEqual([]);
  });
});

describe("what waits in the phone", () => {
  const waiting: CheckDraft = { answers: { q1: answer({ pass: true }) } };
  const conflict: CheckDraft = {
    answers: { q1: answer({ pass: true }) },
    action: { type: "finish" },
    conflict: { name: "Petra", outcome: "failed", skipReason: null, checkedAt: "t" },
  };

  it("counts checks and photos the phone sends by itself", () => {
    expect(fieldTally(pack(), { d1: waiting }, { d1: 2 })).toEqual({
      checks: 1,
      photos: 2,
      decide: [],
      gone: [],
    });
    expect(fieldTally(pack(), { d1: null }, { d1: 0 })).toEqual({
      checks: 0,
      photos: 0,
      decide: [],
      gone: [],
    });
  });

  it("keeps what waits for the technician apart, with its photos", () => {
    expect(fieldTally(pack(), { d1: conflict }, { d1: 1 })).toMatchObject({
      checks: 0,
      photos: 0,
      decide: ["d1"],
    });
    // Chosen "mine": sent by itself again.
    expect(fieldTally(pack(), { d1: { ...conflict, force: true } }, {})).toMatchObject({
      checks: 1,
      decide: [],
    });
    // A refusal on photos alone.
    expect(fieldTally(pack(), { d1: { answers: {}, error: "notFound" } }, { d1: 1 })).toMatchObject(
      { photos: 0, decide: ["d1"] },
    );
  });

  it("names devices no longer in the inspection, also unknown ones", () => {
    const left = { ...pack(), devices: [], gone: [{ id: "d1", number: "0001" }] };
    expect(fieldTally(left, { d1: waiting }, { d9: 1 })).toEqual({
      checks: 1,
      photos: 1,
      decide: [],
      gone: [
        { id: "d1", number: "0001" },
        { id: "d9", number: null },
      ],
    });
  });
});
