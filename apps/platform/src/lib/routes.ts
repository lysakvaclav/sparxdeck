/** Paths reachable without signing in. Everything else requires a session. */
export const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/invite",
  "/api/health",
  // Scheduled jobs authenticate with CRON_SECRET, not a session.
  "/api/cron",
  // Error reports from the browser (also from the sign-in pages).
  "/monitoring",
  // The service worker and the page it shows without a signal (data only from the phone).
  "/sw.js",
  "/offline",
];

/** Signed-in users are sent away from these (to the app). */
export const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export function matchesPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
