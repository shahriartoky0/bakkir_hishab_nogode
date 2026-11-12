import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs in Bangla (the default UI language) against a dev server pointed at
 * a Neon *branch*, never production. Needs OWNER_EMAIL / OWNER_PASSWORD seeded.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "bn-BD",
    timezoneId: "Asia/Dhaka",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
