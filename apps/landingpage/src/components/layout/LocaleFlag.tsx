import { languageOptions, type Locale } from "@/i18n/dictionary";

/** The small country flag for a language switcher link, before its short code. */
export function LocaleFlag({ code }: { code: Locale }) {
  const flag = languageOptions.find((l) => l.code === code)?.flag;
  if (!flag) return null;
  return <span className={`fi fi-${flag}`} aria-hidden />;
}
