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

// Type-specific details kept in devices.attributes (fire extinguisher: agent,
// size; a firm's own type: whatever it defines). Which fields a type has is
// data on the type (device_types.custom_fields), not a hardcoded lookup by
// code: any type, seeded or custom, works the same way.

/** One custom field a device type defines: a key into attributes and its label. */
export type DeviceTypeField = { key: string; label: string };

/** A field's key: short, lowercase, stable (the column it writes doesn't change). */
export const FIELD_KEY = /^[a-z][a-z0-9_]{1,40}$/;
export const MAX_DEVICE_TYPE_FIELDS = 8;
export const FIELD_LABEL_MAX = 60;

/** The type's fields from its stored JSON, dropping anything malformed. */
export function deviceTypeFields(value: Json): DeviceTypeField[] {
  if (!Array.isArray(value)) return [];
  const result: DeviceTypeField[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const key = entry.key;
    const label = entry.label;
    if (typeof key === "string" && typeof label === "string" && FIELD_KEY.test(key))
      result.push({ key, label });
  }
  return result;
}

/** The device's values for the type's own fields, by key (anything else is ignored). */
export function readAttributes(
  value: Json,
  fields: readonly DeviceTypeField[],
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const field of fields) {
    const entry = value[field.key];
    if (typeof entry === "string" && entry.trim()) result[field.key] = entry;
  }
  return result;
}

/** A device type's technical code, derived from its name ("Hydrant" → "hydrant"). */
export function slugifyCode(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const prefixed = /^[a-z]/.test(ascii) ? ascii : `t_${ascii}`;
  const base = (prefixed || "type").slice(0, 40);
  // The database requires a letter plus at least one more character.
  return base.length >= 2 ? base : `${base}0`;
}

/** Attributes to store for a type: only its own fields, empty ones left out. */
export function buildAttributes(
  fields: readonly DeviceTypeField[],
  values: Readonly<Record<string, string | null | undefined>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const entry = values[field.key]?.trim();
    if (entry) result[field.key] = entry;
  }
  return result;
}
