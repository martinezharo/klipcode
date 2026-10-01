import { defineConfig, devices } from "@playwright/test";

/**
 * Backend-less UI flows against the regular dev server on :3000.
 *
 * Cloud-sync behaviour is covered where it actually lives rather than through
 * the browser: `src/__tests__/sync.test.ts` drives the client sync engine
 * against an in-memory deployment, and `src/server/workspace.test.ts` runs the real
 * backend functions (ownership, last-write-wins, cycle rejection, delete
 * cascade) on local D1. Both run in CI with no Docker and no live
 * deployment — which the previous Supabase-backed sync suite could not do.
 */
const testPort = Number(process.env.KLIPCODE_TEST_PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The middleware redirects based on Accept-Language; pin English so
        // prefix-less URLs behave deterministically (Spanish is tested via /es).
        locale: "en-US",
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
  ],
  webServer: [
    {
      command: `pnpm exec next dev --hostname 127.0.0.1 --port ${testPort}`,
      url: `http://127.0.0.1:${testPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
