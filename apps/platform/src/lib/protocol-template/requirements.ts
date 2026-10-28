import { DEFAULT_PROTOCOL_TEMPLATE } from "./default-template";
import { templateSchema, type ProtocolTemplate } from "./schema";
import { isVariable, unknownVariables } from "./variables";

// What every protocol must keep, whatever its template (part 22). Today only
// what identifies the document: its number and the company that issued it,
// both in the header block. What else an inspection protocol must contain is
// not decided yet and needs an expert; it goes here (and only here) once
// confirmed, so the editor and publishing refuse a template without it.
// Besides: what a template needs to be published at all (known variables,
// a readable accent colour, a logo file when the template has its own).

export type TemplateProblem = {
  code:
    | "headerMissing"
    | "headerHidden"
    | "headerTwice"
    | "headerCondition"
    | "unknownVariable"
    | "accentContrast"
    | "logoMissing";
  blockId?: string;
  variable?: string;
};

export const REQUIRED_ELEMENTS = ["protocolNumber", "companyIdentity"] as const;

/** Text in the accent colour on white needs this contrast (WCAG AA). */
export const ACCENT_MIN_CONTRAST = 4.5;

const luminance = (hex: string) => {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/** The contrast of a colour against white (1 to 21). */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** The header keeps the protocol's number and the issuing company: missing, hidden, twice or conditional. */
function headerProblems(template: ProtocolTemplate): TemplateProblem[] {
  const headers = template.blocks.filter((block) => block.type === "header");
  if (headers.length === 0) return [{ code: "headerMissing" }];
  const problems: TemplateProblem[] = [];
  if (headers.length > 1) problems.push({ code: "headerTwice", blockId: headers[1]!.id });
  for (const header of headers) {
    if (header.hidden) problems.push({ code: "headerHidden", blockId: header.id });
    if (header.condition) problems.push({ code: "headerCondition", blockId: header.id });
  }
  return problems;
}

/** Problems that stop a template from being published (a draft may have them). */
export function templateProblems(template: ProtocolTemplate): TemplateProblem[] {
  const problems = headerProblems(template);
  for (const { blockId, variable } of unknownVariables(template))
    problems.push({ code: "unknownVariable", variable, ...(blockId ? { blockId } : {}) });
  for (const block of template.blocks) {
    if (block.condition?.when === "notEmpty" && !isVariable(block.condition.variable))
      problems.push({ code: "unknownVariable", blockId: block.id, variable: block.condition.variable });
    if (block.type === "header" && block.logo.show && block.logo.source === "template" && !block.logo.path)
      problems.push({ code: "logoMissing", blockId: block.id });
  }
  if (template.style.accent && contrastOnWhite(template.style.accent) < ACCENT_MIN_CONTRAST)
    problems.push({ code: "accentContrast" });
  return problems;
}

/**
 * The template a protocol is drawn by: the stored one when it passes the
 * schema and keeps the required elements (the header), otherwise the default.
 * Stored JSON is never trusted as it is.
 */
export function usableTemplate(content: unknown): { template: ProtocolTemplate; fallback: boolean } {
  const parsed = templateSchema.safeParse(content);
  if (parsed.success && headerProblems(parsed.data).length === 0)
    return { template: parsed.data, fallback: false };
  return { template: DEFAULT_PROTOCOL_TEMPLATE, fallback: true };
}
