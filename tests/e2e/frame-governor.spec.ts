import { expect, test } from "@playwright/test";

/**
 * Verifies the request-driven frame governor: rendering is request-mode (not the
 * unconditional loop), frames still advance (never frozen), and camera activity
 * drives a burst of frames. This is the smoke test that a headless run of the
 * WebGL scene actually keeps painting under the new render policy.
 */

type Probe = Window & {
  __globe?: {
    viewer: {
      scene: {
        requestRenderMode: boolean;
        frameState: { frameNumber: number };
        camera: {
          positionCartographic: { clone: () => { height: number } };
          setView: (o: { destination: unknown }) => void;
        };
        globe: { ellipsoid: { cartographicToCartesian: (c: unknown) => unknown } };
      };
    };
  };
};

const frameNumber = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as Probe).__globe?.viewer.scene.frameState.frameNumber ?? -1);

test("governor runs the scene in request-render mode", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  const mode = await page.evaluate(() => (window as Probe).__globe?.viewer.scene.requestRenderMode);
  expect(mode).toBe(true);
});

test("frames keep advancing — the globe never freezes", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as Probe).__globe))).toBeTruthy();

  const first = await frameNumber(page);
  // Even with no interaction, the idle heartbeat + any live layer must repaint.
  await page.waitForTimeout(1500);
  const second = await frameNumber(page);
  expect(second).toBeGreaterThan(first);
});

test("camera motion drives a burst of frames", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").first().waitFor({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as Probe).__globe))).toBeTruthy();

  const before = await frameNumber(page);
  // Drop the camera to ~40 km — a definite scene change the governor must render.
  await page.evaluate(() => {
    const g = (window as Probe).__globe!;
    const carto = g.viewer.scene.camera.positionCartographic.clone();
    carto.height = 40_000;
    g.viewer.scene.camera.setView({ destination: g.viewer.scene.globe.ellipsoid.cartographicToCartesian(carto) });
  });
  await page.waitForTimeout(800);
  const after = await frameNumber(page);
  // The camera change must force at least one fresh render (request-on-change).
  expect(after).toBeGreaterThan(before);
});
