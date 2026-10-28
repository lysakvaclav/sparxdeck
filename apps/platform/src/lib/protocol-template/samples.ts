import { DEFAULT_PROTOCOL_TEMPLATE } from "./default-template";
import type { ProtocolTemplate } from "./schema";

// Sample protocol templates a company can start from (part 22, stage D):
// brief, detailed and an overview. Structure and look only: headings are the
// protocol's own (translated), no wording is made up, so each works in Czech
// and English alike. The summary report across buildings keeps its own fixed
// layout; the overview here is an inspection protocol on one or two pages.

export const SAMPLE_TEMPLATES = ["brief", "detailed", "overview"] as const;
export type SampleTemplate = (typeof SAMPLE_TEMPLATES)[number];

const header = DEFAULT_PROTOCOL_TEMPLATE.blocks[0]! as Extract<ProtocolTemplate["blocks"][number], { type: "header" }>;
const base = { ...DEFAULT_PROTOCOL_TEMPLATE, blocks: [] };

export function sampleTemplate(sample: SampleTemplate): ProtocolTemplate {
  switch (sample) {
    // One page where it can: the result, what to fix, the signatures.
    case "brief":
      return {
        ...base,
        blocks: [
          { ...header, date: true },
          {
            id: "parties",
            type: "parties",
            customer: { show: true, fields: ["billingAddress"] },
            site: { show: true, address: true },
            facts: ["technician", "issued", "version"],
          },
          { id: "summary", type: "summary", title: null, style: "sentence" },
          {
            id: "devices",
            type: "devices",
            title: null,
            summary: false,
            columns: [
              { key: "label", width: 10 },
              { key: "type", width: 30 },
              { key: "location", width: 25 },
              { key: "result", width: 17 },
              { key: "nextDue", width: 18 },
            ],
            columnsWithScan: null,
            details: false,
          },
          { id: "defects", type: "defects", title: null, photos: { perDefect: 0, widthMm: 28 }, whenEmpty: "hide" },
          {
            id: "signatures",
            type: "signatures",
            fields: [
              { role: "technician", label: null },
              { role: "customer", label: null },
            ],
            hint: true,
          },
        ],
      };
    // Everything a protocol can show: device details, every answer, photos.
    case "detailed":
      return {
        ...base,
        style: { ...base.style, table: { borders: "grid", zebra: true } },
        blocks: [
          { ...header, date: true },
          {
            id: "parties",
            type: "parties",
            customer: { show: true, fields: ["billingAddress", "ids", "contact"] },
            site: { show: true, address: true },
            facts: ["date", "technician", "issued", "version"],
          },
          { id: "summary", type: "summary", title: null, style: "table" },
          {
            id: "devices",
            type: "devices",
            title: null,
            summary: false,
            columns: [
              { key: "label", width: 8 },
              { key: "type", width: 16 },
              { key: "location", width: 13 },
              { key: "manufacturer", width: 11 },
              { key: "serial", width: 12 },
              { key: "year", width: 8 },
              { key: "result", width: 12 },
              { key: "nextDue", width: 12 },
            ],
            columnsWithScan: null,
            details: true,
          },
          { id: "checklist", type: "checklist", title: null, style: "detailed" },
          { id: "defects", type: "defects", title: null, photos: { perDefect: 3, widthMm: 40 }, whenEmpty: "text" },
          { id: "gallery", type: "gallery", title: null, source: "inspection", perRow: 4, max: 24, captions: true },
          { id: "notes", type: "notes", title: null },
          {
            id: "signatures",
            type: "signatures",
            fields: [
              { role: "technician", label: null },
              { role: "customer", label: null },
            ],
            hint: true,
          },
        ],
      };
    // An overview: the counts first, devices in short, defects, signatures.
    case "overview":
      return {
        ...base,
        page: { ...base.page, orientation: "landscape" },
        blocks: [
          header,
          {
            id: "parties",
            type: "parties",
            customer: { show: true, fields: ["billingAddress", "contact"] },
            site: { show: true, address: true },
            facts: ["date", "technician", "issued", "version"],
          },
          { id: "summary", type: "summary", title: null, style: "table" },
          {
            id: "checklist",
            type: "checklist",
            title: null,
            style: "compact",
            condition: { when: "failed" },
          },
          {
            id: "devices",
            type: "devices",
            title: null,
            summary: false,
            columns: [
              { key: "label", width: 8 },
              { key: "type", width: 22 },
              { key: "location", width: 22 },
              { key: "result", width: 14 },
              { key: "nextDue", width: 14 },
              { key: "checkedBy", width: 20 },
            ],
            columnsWithScan: null,
            details: false,
          },
          { id: "defects", type: "defects", title: null, photos: { perDefect: 1, widthMm: 30 }, whenEmpty: "text" },
          { id: "notes", type: "notes", title: null },
          {
            id: "signatures",
            type: "signatures",
            fields: [
              { role: "technician", label: null },
              { role: "customer", label: null },
            ],
            hint: true,
          },
        ],
      };
  }
}
