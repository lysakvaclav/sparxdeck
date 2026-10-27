import type { ProtocolTemplate } from "./schema";

// The protocol as it looked before protocol templates (part 22), as a
// template. Every company starts with it (seed_protocol_template in the
// migration stores the same JSON; a test keeps the two equal), and it is what
// a protocol falls back to when its stored template is missing or broken.
// Headings are null: the protocol's own words in its language.

export const DEFAULT_PROTOCOL_TEMPLATE: ProtocolTemplate = {
  schema: 1,
  page: { size: "A4", orientation: "portrait", margins: { top: 14, right: 15, bottom: 14, left: 15 } },
  style: { font: "noto-sans", size: 8.5 },
  blocks: [
    {
      id: "header",
      type: "header",
      logo: { show: true, position: "left", heightMm: 15 },
      company: ["address", "ids", "contact"],
      title: null,
      date: false,
    },
    {
      id: "parties",
      type: "parties",
      customer: { show: true, fields: ["billingAddress", "ids", "contact"] },
      site: { show: true, address: true },
      facts: ["date", "technician", "issued", "version"],
    },
    {
      id: "devices",
      type: "devices",
      title: null,
      summary: true,
      columns: [
        { key: "label", width: 9 },
        { key: "type", width: 23 },
        { key: "location", width: 19 },
        { key: "serial", width: 17 },
        { key: "result", width: 16 },
        { key: "nextDue", width: 16 },
      ],
      columnsWithScan: [
        { key: "label", width: 9 },
        { key: "type", width: 19 },
        { key: "location", width: 16 },
        { key: "serial", width: 15 },
        { key: "result", width: 14 },
        { key: "nextDue", width: 14 },
        { key: "scan", width: 13 },
      ],
      details: true,
    },
    {
      id: "defects",
      type: "defects",
      title: null,
      photos: { perDefect: 2, widthMm: 28 },
      whenEmpty: "text",
    },
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
  footer: { text: "organization", custom: "", pageNumbers: true },
};
