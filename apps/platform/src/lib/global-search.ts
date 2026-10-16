import { labelQuery } from "@/lib/devices";

// What a search in the omnibar can mean besides text: a label number ("12",
// "0012", "#12"), a defect ("Z-12", "D-0012") or a protocol ("2026-0001").

export const SEARCH_KINDS = ["customer", "site", "device", "defect", "protocol"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/** Text shorter than this only matches numbers; one letter would match everything. */
export const MIN_TEXT = 2;
/** Hits per kind. */
export const HITS_PER_KIND = 5;

export type SearchTerms = {
  /** Trimmed text for name searches, or null when too short. */
  text: string | null;
  label: number | null;
  defect: number | null;
  protocol: { year: number; number: number } | null;
};

export function searchTerms(input: string): SearchTerms {
  const value = input.trim().slice(0, 100);
  const defect = /^[zd]\s*-?\s*0*(\d{1,6})$/i.exec(value);
  const protocol = /^(\d{4})\s*[-/]\s*0*(\d{1,6})$/.exec(value);
  return {
    text: value.length >= MIN_TEXT ? value : null,
    label: labelQuery(value),
    defect: defect && Number(defect[1]) > 0 ? Number(defect[1]) : null,
    protocol:
      protocol && Number(protocol[2]) > 0
        ? { year: Number(protocol[1]), number: Number(protocol[2]) }
        : null,
  };
}
