import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, contentSecurityPolicy, createNonce } from "@/lib/security-headers";

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }),
  );

describe("content security policy", () => {
  const supabaseUrl = "https://abc.supabase.co";
  const production = directives(
    contentSecurityPolicy({ nonce: "N0nce", supabaseUrl, dev: false, https: true }),
  );

  it("runs only scripts carrying the nonce, never eval in production", () => {
    expect(production["script-src"]).toEqual(["'self'", "'nonce-N0nce'", "'strict-dynamic'"]);
    expect(production["script-src"]).not.toContain("'unsafe-inline'");
    const dev = directives(
      contentSecurityPolicy({ nonce: "x", supabaseUrl, dev: true, https: false }),
    );
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("talks only to itself and Supabase, and can't be framed", () => {
    expect(production["connect-src"]).toEqual(["'self'", supabaseUrl, "wss://abc.supabase.co"]);
    expect(production["img-src"]).toContain(supabaseUrl);
    expect(production["frame-ancestors"]).toEqual(["'none'"]);
    expect(production["object-src"]).toEqual(["'none'"]);
    expect(production["base-uri"]).toEqual(["'self'"]);
    expect(production["form-action"]).toEqual(["'self'"]);
    expect(production).toHaveProperty("upgrade-insecure-requests");
  });

  it("uses a fresh nonce every time", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(nonces.size).toBe(50);
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("sends the usual hardening headers", () => {
    const names = SECURITY_HEADERS.map((header) => header.key);
    expect(names).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "Referrer-Policy",
        "X-Frame-Options",
        "Permissions-Policy",
        "Strict-Transport-Security",
      ]),
    );
    expect(SECURITY_HEADERS.find((h) => h.key === "Permissions-Policy")?.value).toContain(
      "camera=(self)",
    );
  });
});
