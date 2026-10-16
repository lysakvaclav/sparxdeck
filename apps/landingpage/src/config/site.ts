// Central brand + contact settings. Change values here, not in components.
export const SITE = {
  name: "SparxDeck",
  url: "https://sparxdeck.com",
  email: "hello@sparxdeck.com",
  /** The SparxDeck web app. */
  appUrl: "https://app.sparxdeck.com",
  loginUrl: "https://app.sparxdeck.com/login",
  signupUrl: "https://app.sparxdeck.com/signup",
  /** Where "book a demo" CTAs point (swap for a cal.com link once it exists). */
  bookingUrl: "mailto:hello@sparxdeck.com?subject=SparxDeck%20demo",
  /** Social profiles; leave null to hide the button. */
  social: {
    linkedin: null as string | null,
    x: null as string | null,
  },
} as const;
