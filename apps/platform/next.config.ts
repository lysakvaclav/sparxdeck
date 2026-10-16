import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PDFs are rendered in Node with react-pdf; its fonts are read from disk.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Labels and protocols are rendered from several routes and server actions;
  // the sample floor plan is uploaded by the sample data action.
  outputFileTracingIncludes: { "/**": ["./src/assets/fonts/**", "./src/assets/sample/**"] },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Logos and floor plans are capped at 2 MB; leave headroom for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
    // No on-disk cache for `next dev`: on Windows a dev server stopped by force
    // (turbo, Ctrl+C) leaves it damaged and the next start crashes with a
    // Turbopack panic ("restoring failed"); it also grew to gigabytes.
    turbopackFileSystemCacheForDev: false,
  },
};

// Error tracking: source maps are uploaded only when SENTRY_AUTH_TOKEN is set
// (in the deployment); browser events go through /monitoring on our domain.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  telemetry: false,
});
