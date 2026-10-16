import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The main flow, end to end, as the release check (npm run test:flow). Locally it
// uses the installed Edge against `npm start`; in CI the bundled Chromium.
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = process.env.E2E_APP_URL ?? "http://localhost:3001";
const channel = process.env.CI ? undefined : "msedge";

export default defineConfig({
  testDir: "playwright",
  outputDir: ".e2e-output/playwright",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  // One at a time: Supabase limits sign-ins from one IP address.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // The technician's phone and the office's desktop.
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
  ],
  // Without E2E_APP_URL, start the built app (npm run build first).
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command: "npm run start",
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
