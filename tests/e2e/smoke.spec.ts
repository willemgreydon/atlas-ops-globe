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
  // The ⌘K listener attaches after hydration; wait for the globe canvas (proof
  // the app has mounted) before pressing, else the keypress races the listener.
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
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

test("globe settings drive the render engine", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  // Lock the governor so the quality preset reflects the chosen ceiling.
  await page.getByLabel("Auto-adjust quality").uncheck();
  const sse = () => page.evaluate(() => (window as Window & { __globe?: { viewer: { scene: { globe: { maximumScreenSpaceError: number } } } } }).__globe?.viewer.scene.globe.maximumScreenSpaceError);
  await page.getByLabel("Quality: Perf").click();
  await expect.poll(sse).toBe(4); // performance preset
  await page.getByLabel("Quality: Ultra").click();
  await expect.poll(sse).toBe(1.5); // ultra preset
});

test("mobile: globe stays full-screen and panels dock on demand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });

  // The globe fills the whole workspace (viewport minus the 46px bar + 30px
  // ticker = 768) — nothing permanently occludes it.
  const box = await page.locator(".globe-wrap").boundingBox();
  expect(box?.width).toBeGreaterThan(380);
  expect(box?.height).toBeGreaterThan(740);

  // Panels are closed by default → the mobile tab bar is the only chrome.
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect(page.locator(".hud")).toHaveAttribute("data-dock", "none");

  // Tapping Layers docks the controls sheet in; Close returns to the full globe.
  await page.getByRole("button", { name: "Layers" }).click();
  await expect(page.locator(".hud")).toHaveAttribute("data-dock", "layers");
  await expect(page.getByRole("heading", { name: "Operational Layers" })).toBeVisible();
  await page.locator(".mnav-close").click();
  await expect(page.locator(".hud")).toHaveAttribute("data-dock", "none");
});

test("LOD band tracks the live camera altitude", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  type Probe = Window & {
    __globe?: {
      lod: { getBand: () => string };
      viewer: { scene: { globe: { ellipsoid: unknown } }; camera: { positionCartographic: { clone: () => { height: number } }; setView: (o: { destination: unknown }) => void } };
    };
  };
  const band = () => page.evaluate(() => (window as Probe).__globe?.lod.getBand());
  // Drop the camera to ~30 km (CITY band) by editing only the geodetic height.
  const setHeight = (h: number) =>
    page.evaluate((height) => {
      const g = (window as Probe).__globe!;
      const carto = g.viewer.camera.positionCartographic.clone();
      carto.height = height;
      g.viewer.camera.setView({ destination: (g.viewer.scene.globe.ellipsoid as { cartographicToCartesian: (c: unknown) => unknown }).cartographicToCartesian(carto) });
    }, h);
  await setHeight(30_000);
  await expect.poll(band).toBe("city");
  await setHeight(25_000_000);
  await expect.poll(band).toBe("orbit");
});

test("deep-space environment toggle drives the starfield", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  const starsShown = () =>
    page.evaluate(() => (window as Window & { __globe?: { viewer: { scene: { skyBox?: { show: boolean } } } } }).__globe?.viewer.scene.skyBox?.show);
  // Deep-space environment is on by default → starfield visible.
  await expect.poll(starsShown).toBe(true);
  await page.getByLabel("Deep-space environment").uncheck();
  await expect.poll(starsShown).toBe(false);
  await page.getByLabel("Deep-space environment").check();
  await expect.poll(starsShown).toBe(true);
});
