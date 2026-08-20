import { expect, test } from "@playwright/test";

/**
 * Critical-flow smoke tests (see prompt §41). These drive the real app.
 */
test("app shell loads with brand and modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand")).toContainText("ATLAS");
  await expect(page.getByRole("button", { name: "Global" })).toBeVisible();
});

test("globe canvas initializes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
});

test("a layer can be toggled", async ({ page }) => {
  await page.goto("/");
  const aircraft = page.getByLabel("Toggle Aircraft / ADS-B");
  await expect(aircraft).toBeVisible();
  const before = await aircraft.isChecked();
  await aircraft.click();
  expect(await aircraft.isChecked()).toBe(!before);
});

test("command palette opens and searches countries", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Meta+k");
  const input = page.getByPlaceholder(/Search countries/);
  await expect(input).toBeVisible();
  await input.fill("germany");
  await expect(page.locator(".palette-item").first()).toContainText(/Germany/i);
});

test("mode switching updates telemetry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Aviation" }).click();
  await expect(page.locator(".mode-chip")).toContainText("Aviation");
});

test("health endpoint reports providers", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.providers)).toBe(true);
});
