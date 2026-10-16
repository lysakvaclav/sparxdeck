import type {
  CheckOutcome,
  ChecklistItemType,
  DefectSeverity,
} from "@/lib/supabase/database.types";
import { labelQuery, normalizeToken } from "@/lib/devices";

// The rules of a device check, as the database applies them (save_answer,
// finish_device_check). The phone uses them to say what is missing before it asks.

export type Question = {
  id: string;
  label: string;
  type: ChecklistItemType;
  required: boolean;
  failCreatesDefect: boolean;
};

/** An answer as the form holds it: a number stays text while it's being typed. */
export type AnswerDraft = {
  pass: boolean | null;
  number: string;
  text: string;
  note: string;
  /** The defect a "no" records; null = the question's default (see defectSeverityOf). */
  severity: DefectSeverity | null;
};

export const EMPTY_ANSWER: AnswerDraft = {
  pass: null,
  number: "",
  text: "",
  note: "",
  severity: null,
};

/** "12,5" or "12.5" → 12.5; an empty field is null; anything else NaN. */
export function parseNumber(value: string): number | null {
  const text = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return Number.NaN;
  const number = Number(text);
  return Math.abs(number) < 1_000_000_000 ? number : Number.NaN;
}

export function isAnswered(question: Question, answer: AnswerDraft | undefined): boolean {
  if (!answer) return false;
  switch (question.type) {
    case "pass_fail":
      return answer.pass !== null;
    case "number": {
      const number = parseNumber(answer.number);
      return number !== null && !Number.isNaN(number);
    }
    case "text":
      return answer.text.trim() !== "";
  }
}

/** Required questions still without an answer, in checklist order. */
export function missingRequired(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerDraft>>,
): Question[] {
  return questions.filter(
    (question) => question.required && !isAnswered(question, answers[question.id]),
  );
}

/** Failed as soon as one yes/no question is answered "no". */
export function outcomeOf(
  questions: readonly Question[],
  answers: Readonly<Record<string, AnswerDraft>>,
): Exclude<CheckOutcome, "not_checked"> {
  const failed = questions.some(
    (question) => question.type === "pass_fail" && answers[question.id]?.pass === false,
  );
  return failed ? "failed" : "passed";
}

/**
 * The defect a failed answer records when the inspection is completed: the
 * chosen severity, "major" for questions that always record one, otherwise none.
 */
export function defectSeverityOf(
  question: Question,
  answer: AnswerDraft | undefined,
): DefectSeverity | null {
  if (question.type !== "pass_fail" || answer?.pass !== false) return null;
  return answer.severity ?? (question.failCreatesDefect ? "major" : null);
}

/** The values save_answer receives for a question. */
export function answerPayload(question: Question, answer: AnswerDraft) {
  const number = parseNumber(answer.number);
  return {
    p_value_pass: question.type === "pass_fail" ? answer.pass : null,
    p_value_number:
      question.type === "number" && number !== null && !Number.isNaN(number) ? number : null,
    p_value_text: question.type === "text" ? answer.text.trim() || null : null,
    p_note: answer.note.trim() || null,
    // Drafts saved before severities existed have none.
    p_defect_severity:
      question.type === "pass_fail" && answer.pass === false ? (answer.severity ?? null) : null,
  };
}

export type ScanResult = { token: string } | { labelNumber: number } | null;

/**
 * What a scan or a typed code points to: a label link (…/d/<token>), a bare
 * token, or a label number ("12", "0012"). Links to other sites are ignored.
 */
export function readScan(text: string, appOrigin?: string): ScanResult {
  const value = text.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (appOrigin && url.origin !== new URL(appOrigin).origin) return null;
    const match = /^\/d\/([^/]+)\/?$/i.exec(url.pathname);
    const token = match ? normalizeToken(match[1]!) : null;
    return token ? { token } : null;
  } catch {
    // Not a URL: a token or a label number typed by hand.
  }
  const token = normalizeToken(value);
  if (token) return { token };
  const labelNumber = labelQuery(value);
  return labelNumber ? { labelNumber } : null;
}

/** How long a colleague's hold on a check lasts without activity (as in the database). */
export const HOLD_MINUTES = 10;
