import * as Sentry from "@sentry/nextjs";

// Error tracking on the server (Node and edge). Off until NEXT_PUBLIC_SENTRY_DSN
// is set; no personal data is sent (no IP addresses, cookies or request bodies).
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

/** Errors in server components, route handlers and server actions. */
export const onRequestError = Sentry.captureRequestError;
