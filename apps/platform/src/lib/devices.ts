import type { DeviceStatus, Json } from "@/lib/supabase/database.types";

export const DEVICE_STATUSES = [
  "active",
  "out_of_service",
  "removed",
] as const satisfies readonly DeviceStatus[];

/** Most devices added at once (one building at a time). */
export const BULK_MAX = 100;

/** The printed label number: at least four digits (0007), so labels line up. */
export function formatLabel(labelNumber: number): string {
  return String(labelNumber).padStart(4, "0");
}

/** "Hasicí přístroj 0012": how a device is named in titles, the map and search. */
export function deviceName(typeName: string, labelNumber: number): string {
  return `${typeName} ${formatLabel(labelNumber)}`;
}

/** A label token as the QR code carries it: 12 characters of Crockford base32. */
const TOKEN = /^[0-9a-hjkmnp-tv-z]{12}$/;

/** The token from a scanned or typed label (any letter case), or null. */
export function normalizeToken(value: string): string | null {
  const token = value.trim().toLowerCase();
  return TOKEN.test(token) ? token : null;
}

/** A label number typed into a search box ("7", "0007", "#7"), or null. */
export function labelQuery(input: string): number | null {
  const match = /^#?\s*0*(\d{1,9})$/.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 ? value : null;
}

// Type-specific details kept in devices.attributes. Which fields a type has is a
// form layout, not a rule: the values are free text.
export const DEVICE_ATTRIBUTES = ["agent", "size"] as const;
export type DeviceAttribute = (typeof DEVICE_ATTRIBUTES)[number];

const ATTRIBUTES_BY_TYPE: Record<string, readonly DeviceAttribute[]> = {
  fire_extinguisher: ["agent", "size"],
};

export function attributeFields(typeCode: string | null | undefined): readonly DeviceAttribute[] {
  return (typeCode && ATTRIBUTES_BY_TYPE[typeCode]) || [];
}

/** The known attributes of a device as strings (anything else is ignored). */
export function readAttributes(value: Json): Partial<Record<DeviceAttribute, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Partial<Record<DeviceAttribute, string>> = {};
  for (const key of DEVICE_ATTRIBUTES) {
    const entry = value[key];
    if (typeof entry === "string" && entry.trim()) result[key] = entry;
  }
  return result;
}

/** Attributes to store for a type: only its own fields, empty ones left out. */
export function buildAttributes(
  typeCode: string,
  values: Partial<Record<DeviceAttribute, string | null>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of attributeFields(typeCode)) {
    const entry = values[key]?.trim();
    if (entry) result[key] = entry;
  }
  return result;
}
