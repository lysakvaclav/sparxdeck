/** Marketing site: legal pages (privacy policy, terms) live there; the owner supplies their content. */
export const MARKETING_URL = "https://sparxdeck.com";

export function legalUrl(locale: string, page: "privacy-policy" | "terms-of-use") {
  return `${MARKETING_URL}/${locale}/${page}`;
}
