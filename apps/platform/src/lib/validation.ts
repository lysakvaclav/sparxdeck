import { z } from "zod";
import { DEFECT_SEVERITIES } from "@/lib/defects";
import {
  BULK_MAX,
  DEVICE_STATUSES,
  FIELD_KEY,
  FIELD_LABEL_MAX,
  MAX_DEVICE_TYPE_FIELDS,
} from "@/lib/devices";
import { addDays, isIsoDate, todayInTimeZone } from "@/lib/due";
import {
  CUSTOM_LIMITS,
  DEFAULT_PRESET,
  MAX_LABELS,
  PRESET_LAYOUTS,
  SHEET_PRESETS,
  fitsPage,
  perSheet,
  type SheetLayout,
  type SheetPreset,
} from "@/lib/labels";

// Messages are error codes (see lib/errors.ts) translated in the UI. The same
// schemas validate in the browser (React Hook Form) and again on the server.

const email = z.string().trim().toLowerCase().min(1, "required").pipe(z.email("emailInvalid"));
const password = z.string().min(8, "passwordTooShort").max(72, "tooLong");
const name = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "required"),
});

export const magicLinkSchema = z.object({ email });

export const signupSchema = z.object({ email, password });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string().min(1, "required") })
  .refine((values) => values.password === values.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  organizationName: name(200),
  displayName: name(120),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(["admin", "technician"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(128),
  displayName: name(120),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type OnboardingValues = z.infer<typeof onboardingSchema>;
export type InviteValues = z.infer<typeof inviteSchema>;

export const displayNameSchema = z.object({ displayName: name(120) });

export const changeEmailSchema = z.object({ email });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required"),
    password,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });

export type DisplayNameValues = z.infer<typeof displayNameSchema>;
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Organization settings
// ---------------------------------------------------------------------------

/** Empty input becomes null, so optional fields are cleared in the database. */
const optional = <T extends z.ZodType<unknown, string>>(schema: T) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(schema.nullable());

/**
 * Czech company ID (IČO): 8 digits, the last one a mod-11 check digit.
 * Other formats (other countries) are accepted as long as they look like an ID.
 */
export function isValidCompanyId(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,19}$/.test(value);
  const digits = value.split("").map(Number);
  const sum = digits.slice(0, 7).reduce((acc, digit, index) => acc + digit * (8 - index), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === digits[7];
}

export const companyDetailsSchema = z.object({
  name: name(200),
  legalName: optional(z.string().max(200, "tooLong")),
  companyId: optional(
    z.string().max(20, "tooLong").refine(isValidCompanyId, { message: "companyIdInvalid" }),
  ),
  vatId: optional(
    z
      .string()
      .max(20, "tooLong")
      .transform((value) => value.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{0,3}[0-9A-Z]{2,17}$/, "vatIdInvalid")),
  ),
  address: optional(z.string().max(500, "tooLong")),
  email: optional(z.string().max(254, "tooLong").pipe(z.email("emailInvalid"))),
  phone: optional(
    z
      .string()
      .max(40, "tooLong")
      .regex(/^\+?[0-9 ()./-]{6,40}$/, "phoneInvalid"),
  ),
});

export const protocolSettingsSchema = z.object({
  footer: optional(z.string().max(1000, "tooLong")),
  numberFormat: z.enum(["year_number", "number_year", "year_slash_number"]),
});

export const regionalSettingsSchema = z.object({
  defaultLocale: z.enum(["cs", "en"]),
  timezone: z.string().min(1, "required").max(64, "tooLong"),
});

export const deadlineSettingsSchema = z.object({
  dueSoonDays: z.coerce
    .number<string | number>({ message: "dueSoonDaysInvalid" })
    .int("dueSoonDaysInvalid")
    .min(1, "dueSoonDaysInvalid")
    .max(365, "dueSoonDaysInvalid"),
});

export type CompanyDetailsInput = z.input<typeof companyDetailsSchema>;
export type ProtocolSettingsInput = z.input<typeof protocolSettingsSchema>;
export type RegionalSettingsValues = z.infer<typeof regionalSettingsSchema>;
export type DeadlineSettingsInput = z.input<typeof deadlineSettingsSchema>;

export const digestSettingsSchema = z.object({ weeklyDigest: z.boolean() });

export type DigestSettingsInput = z.input<typeof digestSettingsSchema>;

// ---------------------------------------------------------------------------
// Customers, sites, locations
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: name(200),
  companyId: companyDetailsSchema.shape.companyId,
  vatId: companyDetailsSchema.shape.vatId,
  contactPerson: optional(z.string().max(120, "tooLong")),
  email: companyDetailsSchema.shape.email,
  phone: companyDetailsSchema.shape.phone,
  billingAddress: optional(z.string().max(500, "tooLong")),
  notes: optional(z.string().max(5000, "tooLong")),
});

export const siteSchema = z.object({
  name: name(200),
  address: optional(z.string().max(500, "tooLong")),
  accessNotes: optional(z.string().max(2000, "tooLong")),
  notes: optional(z.string().max(5000, "tooLong")),
});

export const locationNameSchema = z.object({ name: name(200) });

export type CustomerInput = z.input<typeof customerSchema>;
export type SiteInput = z.input<typeof siteSchema>;
export type LocationNameValues = z.infer<typeof locationNameSchema>;

/** Ids coming from the client are checked before they reach a query. */
export const idSchema = z.uuid();
export const idListSchema = z.array(idSchema).max(500);

// ---------------------------------------------------------------------------
// Device types and checklist templates
// ---------------------------------------------------------------------------

export const INTERVAL_MONTHS = { min: 1, max: 120 } as const;

export const deviceTypeFieldSchema = z.object({
  key: z.string().regex(FIELD_KEY, "fieldKeyInvalid"),
  label: name(FIELD_LABEL_MAX),
});

const deviceTypeFields = z
  .array(deviceTypeFieldSchema)
  .max(MAX_DEVICE_TYPE_FIELDS, "fieldsTooMany")
  .refine(
    (fields) => new Set(fields.map((field) => field.key)).size === fields.length,
    "fieldKeyDuplicate",
  );

/** Name, interval and type-specific fields; also used to create a custom type. */
export const deviceTypeSchema = z.object({
  name: name(120),
  interval: z.coerce
    .number<string | number>({ message: "intervalInvalid" })
    .int("intervalInvalid")
    .min(INTERVAL_MONTHS.min, "intervalInvalid")
    .max(INTERVAL_MONTHS.max, "intervalInvalid"),
  fields: deviceTypeFields,
});

export const CHECKLIST_ITEM_TYPES = ["pass_fail", "number", "text"] as const;

export const checklistItemSchema = z
  .object({
    label: name(200),
    type: z.enum(CHECKLIST_ITEM_TYPES),
    required: z.boolean(),
    failCreatesDefect: z.boolean(),
  })
  // Only a yes/no answer can fail, so only it can open a defect.
  .refine((item) => !item.failCreatesDefect || item.type === "pass_fail", {
    message: "defectNeedsPassFail",
    path: ["failCreatesDefect"],
  });

export const checklistTemplateSchema = z.object({
  name: name(160),
  items: z.array(checklistItemSchema).min(1, "templateEmpty").max(100, "templateTooLong"),
  verified: z.boolean(),
});

export type DeviceTypeInput = z.input<typeof deviceTypeSchema>;
export type ChecklistItemValues = z.infer<typeof checklistItemSchema>;
export type ChecklistTemplateValues = z.infer<typeof checklistTemplateSchema>;

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

/** A date can be at most a day ahead of UTC (time zones east of Greenwich). */
function notInFuture(date: string) {
  return date <= addDays(todayInTimeZone("UTC"), 1);
}

/** Optional calendar date from an <input type="date">, not in the future. */
const pastDate = (earliest: string) =>
  optional(
    z
      .string()
      .refine(isIsoDate, { message: "dateInvalid", abort: true })
      .refine((value) => value >= earliest, { message: "dateInvalid", abort: true })
      .refine(notInFuture, "dateInFuture"),
  );

/** Optional calendar date with no "not in the future" limit (end of life: ahead, not behind). */
const anyDate = (earliest: string) =>
  optional(
    z
      .string()
      .refine(isIsoDate, { message: "dateInvalid", abort: true })
      .refine((value) => value >= earliest, { message: "dateInvalid", abort: true }),
  );

const manufactureYear = optional(
  z
    .string()
    .regex(/^\d{4}$/, "yearInvalid")
    .transform(Number)
    .refine((year) => year >= 1950 && year <= new Date().getUTCFullYear() + 1, "yearInvalid"),
);

const requiredId = z.string().min(1, "required").pipe(z.uuid("required"));

/** The type's own fields, by key; unknown keys are the server's problem to drop. */
const customFields = z.record(z.string(), z.string().max(200, "tooLong")).optional();

const deviceFields = {
  deviceTypeId: requiredId,
  locationId: optional(z.uuid("notFound")),
  manufacturer: optional(z.string().max(120, "tooLong")),
  model: optional(z.string().max(120, "tooLong")),
  manufactureYear,
  customFields,
  installedOn: pastDate("1950-01-01"),
  lastInspectionOn: pastDate("1990-01-01"),
  endOfLifeOn: anyDate("1950-01-01"),
  notes: optional(z.string().max(5000, "tooLong")),
};

const serialNumber = optional(z.string().max(80, "tooLong"));

/** A new device: the building is chosen once and never changes. */
export const deviceSchema = z.object({ siteId: requiredId, ...deviceFields, serialNumber });

export const deviceEditSchema = z.object({
  ...deviceFields,
  serialNumber,
  status: z.enum(DEVICE_STATUSES),
});

/** Serial numbers typed one per line; blank lines don't count. */
export function serialLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const bulkDevicesSchema = z
  .object({
    siteId: requiredId,
    ...deviceFields,
    count: z.coerce
      .number<string | number>({ message: "countInvalid" })
      .int("countInvalid")
      .min(1, "countInvalid")
      .max(BULK_MAX, "countInvalid"),
    serialNumbers: z
      .string()
      .max(BULK_MAX * 81, "tooLong")
      .transform(serialLines)
      .pipe(z.array(z.string().max(80, "tooLong")).max(BULK_MAX, "countInvalid")),
  })
  // Serial numbers are optional, but if given, there is one per device.
  .refine(
    (values) => values.serialNumbers.length === 0 || values.serialNumbers.length === values.count,
    { message: "serialCountMismatch", path: ["serialNumbers"] },
  );

/** Moving several devices to another location, or changing their status, at once. */
export const bulkEditDevicesSchema = z
  .object({
    deviceIds: idListSchema.min(1, "required").max(BULK_MAX, "countInvalid"),
    // Explicit presence, not just a non-empty string: "" means "no location" for
    // locationId, but absence means "don't touch this field" for the bulk edit.
    locationId: z.uuid("notFound").nullable().optional(),
    status: z.enum(DEVICE_STATUSES).optional(),
  })
  .refine((values) => values.locationId !== undefined || values.status !== undefined, {
    message: "required",
    path: ["status"],
  });

/** Moving a device to another building and/or location, with an optional note. */
export const moveDeviceSchema = z.object({
  siteId: z.uuid("required"),
  locationId: optional(z.uuid("notFound")),
  note: optional(z.string().max(500, "tooLong")),
});

export type DeviceInput = z.input<typeof deviceSchema>;
export type DeviceEditInput = z.input<typeof deviceEditSchema>;
export type BulkDevicesInput = z.input<typeof bulkDevicesSchema>;
export type BulkEditDevicesInput = z.input<typeof bulkEditDevicesSchema>;
export type MoveDeviceInput = z.input<typeof moveDeviceSchema>;

// ---------------------------------------------------------------------------
// Label printing
// ---------------------------------------------------------------------------

const layoutNumber = (min: number, max: number) =>
  z.coerce
    .number<string | number>({ message: "layoutInvalid" })
    .min(min, "layoutInvalid")
    .max(max, "layoutInvalid");
const layoutCount = (min: number, max: number) => layoutNumber(min, max).int("layoutInvalid");

/** A sheet the user measured themselves; it has to fit on A4. */
export const customLayoutSchema = z
  .object({
    columns: layoutCount(CUSTOM_LIMITS.columns.min, CUSTOM_LIMITS.columns.max),
    rows: layoutCount(CUSTOM_LIMITS.rows.min, CUSTOM_LIMITS.rows.max),
    labelWidth: layoutNumber(CUSTOM_LIMITS.labelWidth.min, CUSTOM_LIMITS.labelWidth.max),
    labelHeight: layoutNumber(CUSTOM_LIMITS.labelHeight.min, CUSTOM_LIMITS.labelHeight.max),
    marginTop: layoutNumber(CUSTOM_LIMITS.margin.min, CUSTOM_LIMITS.margin.max),
    marginLeft: layoutNumber(CUSTOM_LIMITS.margin.min, CUSTOM_LIMITS.margin.max),
    gapX: layoutNumber(CUSTOM_LIMITS.gap.min, CUSTOM_LIMITS.gap.max),
    gapY: layoutNumber(CUSTOM_LIMITS.gap.min, CUSTOM_LIMITS.gap.max),
  })
  .refine(fitsPage, { message: "labelsDontFit", path: ["labelWidth"] });

export const labelPrintSchema = z
  .object({
    deviceIds: z.array(z.uuid("labelsNone")).min(1, "labelsNone").max(500, "labelsTooMany"),
    copies: z.coerce
      .number<string | number>({ message: "copiesInvalid" })
      .int("copiesInvalid")
      .min(1, "copiesInvalid")
      .max(10, "copiesInvalid"),
    startAt: z.coerce
      .number<string | number>({ message: "startInvalid" })
      .int("startInvalid")
      .min(1, "startInvalid"),
    preset: z.enum([...SHEET_PRESETS, "custom"]),
    custom: customLayoutSchema.optional(),
  })
  .superRefine((values, ctx) => {
    if (values.preset === "custom" && !values.custom) {
      ctx.addIssue({ code: "custom", message: "layoutInvalid", path: ["custom"] });
      return;
    }
    const layout = sheetLayoutOf(values);
    if (values.startAt > perSheet(layout))
      ctx.addIssue({ code: "custom", message: "startInvalid", path: ["startAt"] });
    if (values.deviceIds.length * values.copies > MAX_LABELS)
      ctx.addIssue({ code: "custom", message: "labelsTooMany", path: ["copies"] });
  });

/** The sheet a print request uses: a preset, or the custom measurements. */
export function sheetLayoutOf(values: {
  preset: SheetPreset | "custom";
  custom?: SheetLayout;
}): SheetLayout {
  return values.preset === "custom" && values.custom
    ? values.custom
    : PRESET_LAYOUTS[values.preset === "custom" ? DEFAULT_PRESET : values.preset];
}

export type LabelPrintValues = z.infer<typeof labelPrintSchema>;

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export const completeInspectionSchema = z.object({
  notes: optional(z.string().max(5000, "tooLong")),
  /** A canvas signature as base64 PNG (no "data:" prefix); dropped if it isn't. */
  signature: optional(z.string().max(500_000, "tooLong")),
  signerName: optional(z.string().max(200, "tooLong")),
});

export type CompleteInspectionInput = z.input<typeof completeInspectionSchema>;

/** Why a completed inspection is reopened for a correction (kept as a record). */
export const reopenInspectionSchema = z.object({ reason: name(1000) });

export type ReopenInspectionInput = z.input<typeof reopenInspectionSchema>;

/** Where a protocol is e-mailed (one recipient; the customer's address by default). */
export const protocolEmailSchema = z.object({ email });

export type ProtocolEmailInput = z.input<typeof protocolEmailSchema>;

// ---------------------------------------------------------------------------
// Defects
// ---------------------------------------------------------------------------

export const defectSchema = z.object({
  deviceId: requiredId,
  description: name(2000),
  severity: z.enum(DEFECT_SEVERITIES),
});

export const defectNoteSchema = z.object({ note: name(2000) });

export const defectDescriptionSchema = z.object({ description: name(2000) });

export type DefectInput = z.input<typeof defectSchema>;

// ---------------------------------------------------------------------------
// Floor plans
// ---------------------------------------------------------------------------

/** Name and floor of a plan (the image itself is checked separately, by content). */
export const floorPlanSchema = z.object({
  name: name(200),
  locationId: optional(z.uuid("notFound")),
});

/** A device's spot on a plan, 0..1 from the plan's left and top edge. */
export const placementSchema = z.object({
  planId: requiredId,
  deviceId: requiredId,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export type FloorPlanInput = z.input<typeof floorPlanSchema>;
export type FloorPlanValues = z.output<typeof floorPlanSchema>;
export type PlacementInput = z.input<typeof placementSchema>;

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Most rows one import takes (the database checks the same limit). */
export const IMPORT_MAX_ROWS = 5000;
/** Most devices one row makes ("Počet" column). */
export const IMPORT_MAX_QUANTITY = 100;

/** One imported row, after the browser read and cleaned it: what the database gets. */
export const importRecordSchema = z.object({
  customer: z.object({
    name: name(200),
    companyId: companyDetailsSchema.shape.companyId,
    contactPerson: optional(z.string().max(120, "tooLong")),
    email: companyDetailsSchema.shape.email,
    phone: companyDetailsSchema.shape.phone,
    billingAddress: optional(z.string().max(500, "tooLong")),
  }),
  site: z.object({
    name: name(200),
    address: optional(z.string().max(500, "tooLong")),
    accessNotes: optional(z.string().max(2000, "tooLong")),
  }),
  location: optional(z.string().max(200, "tooLong")),
  device: z
    .object({
      deviceTypeId: requiredId,
      serialNumber,
      manufacturer: deviceFields.manufacturer,
      model: deviceFields.model,
      manufactureYear: deviceFields.manufactureYear,
      customFields: deviceFields.customFields,
      installedOn: deviceFields.installedOn,
      lastInspectionOn: deviceFields.lastInspectionOn,
      notes: deviceFields.notes,
    })
    .nullable(),
});

export const importSchema = z.object({
  fileName: z.string().trim().min(1, "required").max(255, "tooLong"),
  records: z.array(importRecordSchema).min(1, "importEmpty").max(IMPORT_MAX_ROWS, "importTooLarge"),
});

export type ImportRecordInput = z.input<typeof importRecordSchema>;
export type ImportRecord = z.output<typeof importRecordSchema>;
export type ImportInput = z.input<typeof importSchema>;

// ---------------------------------------------------------------------------
// In the field: a device found during an inspection, a device left out
// ---------------------------------------------------------------------------

/** A device added during an inspection: no dates (it's being checked right now). */
export const inspectionDeviceSchema = z.object({
  deviceTypeId: deviceFields.deviceTypeId,
  locationId: deviceFields.locationId,
  serialNumber,
  manufacturer: deviceFields.manufacturer,
  model: deviceFields.model,
  manufactureYear: deviceFields.manufactureYear,
  customFields: deviceFields.customFields,
  notes: optional(z.string().max(2000, "tooLong")),
});

export const CHECK_SKIP_REASONS = ["inaccessible", "missing"] as const;

export const skipCheckSchema = z.object({
  reason: z.enum(CHECK_SKIP_REASONS, { message: "required" }),
  note: optional(z.string().max(2000, "tooLong")),
});

export type InspectionDeviceInput = z.input<typeof inspectionDeviceSchema>;
export type InspectionDeviceValues = z.output<typeof inspectionDeviceSchema>;
export type SkipCheckInput = z.input<typeof skipCheckSchema>;
export type SkipCheckValues = z.output<typeof skipCheckSchema>;
