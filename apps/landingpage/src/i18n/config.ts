export const locales = [
  "cs", "en", "de", "fr", "pl", "sq", "ar", "hy", "ka", "ru",
  "uk", "sr", "bs", "cnr", "mk", "tr",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "cs";
