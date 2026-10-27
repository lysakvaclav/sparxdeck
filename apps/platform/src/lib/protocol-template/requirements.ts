import { DEFAULT_PROTOCOL_TEMPLATE } from "./default-template";
import { templateSchema, type ProtocolTemplate } from "./schema";

// What every protocol must keep, whatever its template (part 22). Today only
// what identifies the document: its number and the company that issued it,
// both in the header block. What else an inspection protocol must contain is
// not decided yet and needs an expert; it goes here (and only here) once
// confirmed, so the editor and publishing refuse a template without it.

export type TemplateProblem = {
  code: "headerMissing" | "headerHidden" | "headerTwice";
  blockId?: string;
};

export const REQUIRED_ELEMENTS = ["protocolNumber", "companyIdentity"] as const;

/** Problems that stop a template from being published (a draft may have them). */
export function templateProblems(template: ProtocolTemplate): TemplateProblem[] {
  const headers = template.blocks.filter((block) => block.type === "header");
  if (headers.length === 0) return [{ code: "headerMissing" }];
  const problems: TemplateProblem[] = [];
  if (headers.length > 1) problems.push({ code: "headerTwice", blockId: headers[1]!.id });
  for (const header of headers)
    if (header.hidden) problems.push({ code: "headerHidden", blockId: header.id });
  return problems;
}

/**
 * The template a protocol is drawn by: the stored one when it passes the
 * schema and keeps the required elements, otherwise the default. Stored JSON
 * is never trusted as it is.
 */
export function usableTemplate(content: unknown): { template: ProtocolTemplate; fallback: boolean } {
  const parsed = templateSchema.safeParse(content);
  if (parsed.success && templateProblems(parsed.data).length === 0)
    return { template: parsed.data, fallback: false };
  return { template: DEFAULT_PROTOCOL_TEMPLATE, fallback: true };
}
