import * as Sentry from "@sentry/nextjs";

// Error tracking in the browser. Off until NEXT_PUBLIC_SENTRY_DSN is set; events
// go through /monitoring on our own domain (CSP stays "self", blockers don't drop them).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
