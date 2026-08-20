import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for critical flows. Requires browsers:
 *   pnpm exec playwright install chromium
 * Then: pnpm test:e2e  (starts the dev server automatically)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
