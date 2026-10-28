import type { ProtocolTemplate } from "./schema";

// Variables of a protocol template (part 22, stage C): {{zakaznik.nazev}} in a
// heading, a text, a table cell, a signature's label or the footer is replaced
// by the protocol's data when it is drawn. The value is always put in as plain
// text (a PDF has no markup to inject into). An unknown variable is reported
// in the editor and keeps a template from being published; drawn, it stays as
// written so it is seen.

export const VARIABLE_GROUPS = {
  firma: ["nazev", "ico", "dic", "adresa", "email", "telefon"],
  zakaznik: ["nazev", "ico", "dic", "adresa", "kontakt"],
  budova: ["nazev", "adresa"],
  revize: ["datum", "zahajeni", "dokonceni", "poznamka"],
  technik: ["jmeno", "vsichni"],
  protokol: ["cislo", "verze", "vystaveno"],
  vysledek: ["text", "celkem", "vyhovuje", "nevyhovuje", "nezkontrolovano"],
  zavady: ["pocet"],
  podpis: ["zakaznik"],
} as const;

type Groups = typeof VARIABLE_GROUPS;
export type VariableKey = {
  [G in keyof Groups]: `${G & string}.${Groups[G][number]}`;
}[keyof Groups];

export const VARIABLES = Object.entries(VARIABLE_GROUPS).flatMap(([group, names]) =>
  names.map((name) => `${group}.${name}`),
) as VariableKey[];

const KNOWN = new Set<string>(VARIABLES);
export const isVariable = (key: string): key is VariableKey => KNOWN.has(key);

/** {{ key }} with any spacing; the key as written (to report a misspelt one). */
const TOKEN = /\{\{([^{}]{0,60})\}\}/g;

export const variableToken = (key: VariableKey) => `{{${key}}}`;

/** The variables written in a text, known or not, in order. */
export function variablesIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((match) => match[1]!.trim());
}

/** Puts the values in; an unknown variable stays as written. */
export function fillVariables(text: string, values: Partial<Record<VariableKey, string>>): string {
  if (!text.includes("{{")) return text;
  return text.replace(TOKEN, (token, key: string) => {
    const name = key.trim();
    return isVariable(name) ? (values[name] ?? "") : token;
  });
}

/** Every text of a template where variables may be written, with its block. */
export function templateTexts(template: ProtocolTemplate): { blockId: string | null; text: string }[] {
  const texts: { blockId: string | null; text: string }[] = [];
  const add = (blockId: string | null, text: string | null | undefined) => {
    if (text) texts.push({ blockId, text });
  };
  for (const block of template.blocks) {
    if ("title" in block) add(block.id, block.title);
    if (block.type === "text")
      for (const node of block.content) {
        const lines = node.type === "list" ? node.items : [node.content];
        for (const line of lines) for (const inline of line) add(block.id, inline.text);
      }
    if (block.type === "table") {
      for (const column of block.columns) add(block.id, column.title);
      for (const row of block.rows) for (const cell of row) add(block.id, cell);
    }
    if (block.type === "signatures") for (const field of block.fields) add(block.id, field.label);
  }
  if (template.footer.text === "custom") add(null, template.footer.custom);
  return texts;
}

/** Variables written in the template that don't exist, by block (null = the footer). */
export function unknownVariables(template: ProtocolTemplate): { blockId: string | null; variable: string }[] {
  const seen = new Set<string>();
  const unknown: { blockId: string | null; variable: string }[] = [];
  for (const { blockId, text } of templateTexts(template))
    for (const variable of variablesIn(text))
      if (!isVariable(variable) && !seen.has(`${blockId}:${variable}`)) {
        seen.add(`${blockId}:${variable}`);
        unknown.push({ blockId, variable });
      }
  return unknown;
}
