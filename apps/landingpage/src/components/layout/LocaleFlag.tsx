import { languageOptions, type Locale } from "@/i18n/dictionary";

/**
 * The small country flag for a language switcher link, before its short code.
 * A fixed small size (not inherited from the surrounding text), so a long row
 * of 16 languages stays compact and on one line.
 */
export function LocaleFlag({ code }: { code: Locale }) {
  const flag = languageOptions.find((l) => l.code === code)?.flag;
  if (!flag) return null;
  return (
    <span className="inline-block shrink-0 text-[10px] align-[-1px]">
      <span className={`fi fi-${flag}`} aria-hidden />
    </span>
  );
}
