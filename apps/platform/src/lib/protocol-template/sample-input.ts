import type { ProtocolCheck, ProtocolInput, ProtocolLocale } from "@/lib/protocol";

// Data for the template editor's preview (part 22, stage B): the company's own
// identity with a made-up customer, building and inspection, so every block
// shows something. The words come from "protocolTemplates.sample" in the
// protocol's language.

export type SampleTexts = {
  customer: string;
  contact: string;
  billingAddress: string;
  site: string;
  siteAddress: string;
  technician: string;
  colleague: string;
  signer: string;
  type: string;
  typeHydrant: string;
  basement: string;
  floor: string;
  seal: string;
  pressure: string;
  label: string;
  sealMissing: string;
  noteBlocked: string;
  defectSeal: string;
  defectGauge: string;
  notes: string;
};

export type SampleOrganization = ProtocolInput["organization"] & {
  timeZone: string;
  scanLocation: boolean;
};

export function sampleInput(
  organization: SampleOrganization,
  locale: ProtocolLocale,
  texts: SampleTexts,
  now = new Date(),
): ProtocolInput {
  const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const device = (values: Partial<ProtocolCheck> & { labelNumber: number }): ProtocolCheck => ({
    typeName: texts.type,
    locationName: texts.floor,
    locationOrder: 2,
    serialNumber: `HP-${2400 + values.labelNumber}`,
    manufacturer: "Hasco",
    model: "P6Če",
    manufactureYear: 2018 + (values.labelNumber % 6),
    outcome: "passed",
    nextDueOn: nextYear,
    checkedBy: texts.technician,
    note: null,
    answers: [
      { question: texts.seal, type: "pass_fail", order: 1, pass: true, number: null, text: null, note: null },
      { question: texts.pressure, type: "number", order: 2, pass: null, number: 14.2, text: null, note: null },
      { question: texts.label, type: "pass_fail", order: 3, pass: true, number: null, text: null, note: null },
    ],
    scanLocation: organization.scanLocation ? { state: "matches", note: null } : null,
    ...values,
  });
  return {
    locale,
    timeZone: organization.timeZone,
    year: now.getUTCFullYear(),
    number: 42,
    version: 1,
    organization,
    customer: {
      name: texts.customer,
      companyId: "12345678",
      vatId: null,
      contactPerson: texts.contact,
      billingAddress: texts.billingAddress,
    },
    site: { name: texts.site, address: texts.siteAddress },
    startedAt: day(-1).toISOString(),
    completedAt: now.toISOString(),
    generatedAt: now.toISOString(),
    completedBy: texts.technician,
    notes: texts.notes,
    checks: [
      device({ labelNumber: 1, locationName: texts.basement, locationOrder: 1 }),
      device({
        labelNumber: 2,
        locationName: texts.basement,
        locationOrder: 1,
        outcome: "failed",
        nextDueOn: null,
        answers: [
          { question: texts.seal, type: "pass_fail", order: 1, pass: false, number: null, text: null, note: texts.sealMissing },
          { question: texts.pressure, type: "number", order: 2, pass: null, number: 9.8, text: null, note: null },
          { question: texts.label, type: "pass_fail", order: 3, pass: true, number: null, text: null, note: null },
        ],
      }),
      device({ labelNumber: 3 }),
      device({ labelNumber: 4, checkedBy: texts.colleague }),
      device({
        labelNumber: 5,
        typeName: texts.typeHydrant,
        model: null,
        outcome: "not_checked",
        skipReason: "inaccessible",
        nextDueOn: null,
        note: texts.noteBlocked,
        answers: [],
        scanLocation: organization.scanLocation ? { state: null, note: null } : null,
      }),
    ],
    defects: [
      { number: 17, labelNumber: 2, description: texts.defectSeal, severity: "major", again: false },
      { number: 9, labelNumber: 2, description: texts.defectGauge, severity: "minor", again: true },
    ],
    customerSignature: { name: texts.signer, signedAt: now.toISOString() },
    scanLocation: organization.scanLocation,
  };
}
