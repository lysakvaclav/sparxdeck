// Central brand + contact settings. Change values here, not in components.

/** Addresses can be set per deployment (e.g. *.vercel.app before the domain exists). */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sparxdeck.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.sparxdeck.com";

export const SITE = {
  name: "SparxDeck",
  url: siteUrl,
  email: "info@sparxdeck.com",
  /** The SparxDeck web app. */
  appUrl,
  loginUrl: `${appUrl}/login`,
  signupUrl: `${appUrl}/signup`,
  /** Where "book a demo" CTAs point (swap for a cal.com link once it exists). */
  bookingUrl: "mailto:info@sparxdeck.com?subject=SparxDeck%20demo",
  /** Social profiles; leave null to hide the button. */
  social: {
    linkedin: "https://www.linkedin.com/company/sparxdeck/home" as string | null,
    x: null as string | null,
  },
} as const;
