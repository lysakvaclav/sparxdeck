import type { Dictionary } from "./types";
import { defaultLocale, locales, type Locale } from "./config";
import cs from "./locales/cs";
import en from "./locales/en";
import de from "./locales/de";
import fr from "./locales/fr";
import pl from "./locales/pl";
import sq from "./locales/sq";
import ar from "./locales/ar";
import hy from "./locales/hy";
import ka from "./locales/ka";
import ru from "./locales/ru";
import uk from "./locales/uk";
import sr from "./locales/sr";
import bs from "./locales/bs";
import cnr from "./locales/cnr";
import mk from "./locales/mk";
import tr from "./locales/tr";

export type * from "./types";
export { defaultLocale, locales, type Locale };

const rtlLocales: readonly Locale[] = ["ar"];

export const dictionaries: Record<Locale, Dictionary> = {
  cs, en, de, fr, pl, sq, ar, hy, ka, ru, uk, sr, bs, cnr, mk, tr,
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export function getDictionary(locale: string | undefined | null): Dictionary {
  return isLocale(locale) ? dictionaries[locale] : dictionaries[defaultLocale];
}

export const languageOptions: {
  code: Locale;
  label: string;
  nativeName: string;
  /** Short label used in footer language links */
  short: string;
  /** flag-icons country code */
  flag: string;
}[] = [
  { code: "cs", label: "Czech", nativeName: "Čeština", short: "CZ", flag: "cz" },
  { code: "en", label: "English", nativeName: "English", short: "EN", flag: "gb" },
  { code: "de", label: "German", nativeName: "Deutsch", short: "DE", flag: "de" },
  { code: "fr", label: "French", nativeName: "Français", short: "FR", flag: "fr" },
  { code: "pl", label: "Polish", nativeName: "Polski", short: "PL", flag: "pl" },
  { code: "sq", label: "Albanian", nativeName: "Shqip", short: "SQ", flag: "al" },
  { code: "ar", label: "Arabic", nativeName: "العربية", short: "AR", flag: "ae" },
  { code: "hy", label: "Armenian", nativeName: "Հայերեն", short: "HY", flag: "am" },
  { code: "ka", label: "Georgian", nativeName: "ქართული", short: "KA", flag: "ge" },
  { code: "ru", label: "Russian", nativeName: "Русский", short: "RU", flag: "ru" },
  { code: "uk", label: "Ukrainian", nativeName: "Українська", short: "UA", flag: "ua" },
  { code: "sr", label: "Serbian", nativeName: "Српски", short: "SR", flag: "rs" },
  { code: "bs", label: "Bosnian", nativeName: "Bosanski", short: "BS", flag: "ba" },
  { code: "cnr", label: "Montenegrin", nativeName: "Crnogorski", short: "ME", flag: "me" },
  { code: "mk", label: "Macedonian", nativeName: "Македонски", short: "MK", flag: "mk" },
  { code: "tr", label: "Turkish", nativeName: "Türkçe", short: "TR", flag: "tr" },
];

export function shortLabel(locale: Locale): string {
  return languageOptions.find((l) => l.code === locale)?.short ?? locale.toUpperCase();
}
