// The Content Security Policy for app pages. Scripts run only with the
// request's nonce (Next.js adds it to its own scripts; 'strict-dynamic' lets
// them load the rest), the app talks only to itself and Supabase, and no other
// site may frame it. Styles allow inline (React style attributes, Radix).

export function contentSecurityPolicy({
  nonce,
  supabaseUrl,
  dev,
  https,
}: {
  nonce: string;
  supabaseUrl: string;
  dev: boolean;
  /** Served over HTTPS: then plain-http links are upgraded (not on a LAN test address). */
  https: boolean;
}): string {
  const supabase = new URL(supabaseUrl);
  const supabaseWs = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's development build evaluates code; production never does.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Signed links to photos and logos, QR codes and previews drawn in the page.
    "img-src": ["'self'", "data:", "blob:", supabase.origin],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase.origin, supabaseWs],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(https ? { "upgrade-insecure-requests": [] } : {}),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

/** A fresh nonce per response: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Headers for every response (pages, files, API). */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The camera is for scanning labels and taking photos, the position for the
  // moment of a scan and a building's point; on this site only.
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  // Browsers ignore it over plain http (local development).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
