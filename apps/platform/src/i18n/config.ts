// Supported UI languages. Add a locale here and a matching messages/<locale>.json.
// Right-to-left locales (e.g. "ar") also go into RTL_LOCALES; the layout uses
// logical CSS properties (ps-/pe-, start/end) so it mirrors without changes.
export const LOCALES = ["cs", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "cs";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const RTL_LOCALES: readonly Locale[] = [];

export const LOCALE_NAMES: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
