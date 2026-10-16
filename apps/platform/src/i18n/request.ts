import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

// The locale comes from a cookie (set by the language switcher), falling back to
// the browser's Accept-Language. URLs carry no locale: QR codes printed on devices
// must keep working regardless of language.
async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

// A locale passed explicitly (getTranslations({ locale })) wins: protocols and
// e-mails to customers are written in the organization's language, not the reader's.
export default getRequestConfig(async ({ locale: requested }) => {
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Prague",
  };
});
