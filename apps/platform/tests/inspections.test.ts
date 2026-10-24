import { describe, expect, it } from "vitest";
import {
  EMPTY_ANSWER,
  answerPayload,
  defectSeverityOf,
  isAnswered,
  missingPhotos,
  missingRequired,
  outcomeOf,
  parseNumber,
  readScan,
  type AnswerDraft,
  type Question,
} from "@/lib/inspections";

const question = (
  id: string,
  type: Question["type"],
  required = true,
  photoRequired = false,
): Question => ({
  id,
  label: id,
  type,
  required,
  failCreatesDefect: false,
  photoRequired,
});
const answer = (values: Partial<AnswerDraft>): AnswerDraft => ({ ...EMPTY_ANSWER, ...values });

describe("device check rules", () => {
  const questions = [
    question("seal", "pass_fail"),
    question("pressure", "number"),
    question("label", "pass_fail", false),
    question("remark", "text", false),
    question("reading", "text"),
  ];

  it("a photo-required question needs a photo of its own, sent or waiting in the phone", () => {
    const withPhotos = [
      question("gauge", "number", true, true),
      question("seal", "pass_fail"),
      question("overall", "text", false, true),
    ];
    expect(missingPhotos(withPhotos, {}).map((q) => q.id)).toEqual(["gauge", "overall"]);
    expect(missingPhotos(withPhotos, { gauge: 1, seal: 2 }).map((q) => q.id)).toEqual(["overall"]);
    expect(missingPhotos(withPhotos, { gauge: 1, overall: 3 })).toEqual([]);
    // Optional answer, required photo: the photo is still required.
    expect(missingPhotos(withPhotos, { gauge: 1, overall: 0 }).map((q) => q.id)).toEqual([
      "overall",
    ]);
  });

  it("reads numbers with a decimal comma or point", () => {
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber(" 12.5 ")).toBe(12.5);
    expect(parseNumber("-3")).toBe(-3);
    expect(parseNumber("1 200")).toBe(1200);
    expect(parseNumber("")).toBeNull();
    for (const bad of ["12,5,1", "abc", "1e3", "12.", "1000000000"])
      expect(parseNumber(bad), bad).toBeNaN();
  });

  it("lists required questions without an answer", () => {
    expect(missingRequired(questions, {}).map((q) => q.id)).toEqual([
      "seal",
      "pressure",
      "reading",
    ]);
    const answers = {
      seal: answer({ pass: false }),
      pressure: answer({ number: "abc" }),
      reading: answer({ text: "  " }),
    };
    expect(missingRequired(questions, answers).map((q) => q.id)).toEqual(["pressure", "reading"]);
    expect(
      missingRequired(questions, {
        ...answers,
        pressure: answer({ number: "1,2" }),
        reading: answer({ text: "OK" }),
      }),
    ).toEqual([]);
    expect(isAnswered(question("x", "pass_fail"), undefined)).toBe(false);
  });

  it("fails on any 'no', even on an optional question", () => {
    expect(outcomeOf(questions, { seal: answer({ pass: true }) })).toBe("passed");
    expect(
      outcomeOf(questions, { seal: answer({ pass: true }), label: answer({ pass: false }) }),
    ).toBe("failed");
    expect(outcomeOf(questions, {})).toBe("passed");
  });

  it("sends only the value that fits the question", () => {
    const draft = answer({ pass: true, number: "2,5", text: " text ", note: "  " });
    expect(answerPayload(question("a", "pass_fail"), draft)).toEqual({
      p_value_pass: true,
      p_value_number: null,
      p_value_text: null,
      p_note: null,
      p_defect_severity: null,
    });
    expect(answerPayload(question("b", "number"), draft)).toMatchObject({ p_value_number: 2.5 });
    expect(answerPayload(question("b", "number"), answer({ number: "x" }))).toMatchObject({
      p_value_number: null,
    });
    expect(answerPayload(question("c", "text"), draft)).toMatchObject({ p_value_text: "text" });
  });

  it("sends a defect severity only with a failed answer", () => {
    const failed = answer({ pass: false, severity: "critical" });
    expect(answerPayload(question("a", "pass_fail"), failed)).toMatchObject({
      p_defect_severity: "critical",
    });
    // Changed to "yes" after choosing a severity: the severity goes away.
    expect(answerPayload(question("a", "pass_fail"), { ...failed, pass: true })).toMatchObject({
      p_defect_severity: null,
    });
    // A draft saved before severities existed.
    const old = { pass: false, number: "", text: "", note: "" } as AnswerDraft;
    expect(answerPayload(question("a", "pass_fail"), old)).toMatchObject({
      p_defect_severity: null,
    });
  });

  it("knows which failed answers record a defect", () => {
    const always = { ...question("seal", "pass_fail"), failCreatesDefect: true };
    const optional = question("label", "pass_fail");
    expect(defectSeverityOf(always, answer({ pass: false }))).toBe("major");
    expect(defectSeverityOf(always, answer({ pass: false, severity: "minor" }))).toBe("minor");
    expect(defectSeverityOf(always, answer({ pass: true }))).toBeNull();
    expect(defectSeverityOf(always, undefined)).toBeNull();
    expect(defectSeverityOf(optional, answer({ pass: false }))).toBeNull();
    expect(defectSeverityOf(optional, answer({ pass: false, severity: "critical" }))).toBe(
      "critical",
    );
    expect(defectSeverityOf(question("n", "number"), answer({ severity: "minor" }))).toBeNull();
  });
});

describe("reading a scanned label", () => {
  const app = "https://app.sparxdeck.com";

  it("takes the token from our label link, in any letter case", () => {
    expect(readScan("https://app.sparxdeck.com/d/h7k2m9p4q8r3", app)).toEqual({
      token: "h7k2m9p4q8r3",
    });
    expect(readScan("HTTPS://APP.SPARXDECK.COM/D/H7K2M9P4Q8R3", app)).toEqual({
      token: "h7k2m9p4q8r3",
    });
    expect(readScan("h7k2m9p4q8r3")).toEqual({ token: "h7k2m9p4q8r3" });
  });

  it("ignores other sites and other paths", () => {
    expect(readScan("https://evil.example/d/h7k2m9p4q8r3", app)).toBeNull();
    expect(readScan("https://app.sparxdeck.com/devices/h7k2m9p4q8r3", app)).toBeNull();
    expect(readScan("https://app.sparxdeck.com/d/short", app)).toBeNull();
    expect(readScan("", app)).toBeNull();
    expect(readScan("hello world")).toBeNull();
  });

  it("accepts a label number typed by hand", () => {
    expect(readScan("12")).toEqual({ labelNumber: 12 });
    expect(readScan("0012")).toEqual({ labelNumber: 12 });
    expect(readScan("#7")).toEqual({ labelNumber: 7 });
  });
});
