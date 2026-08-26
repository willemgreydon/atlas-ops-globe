/**
 * Cesium-free surface config (mission §9).
 *
 * The type + token check live here, apart from `terrain.ts`, so client shells
 * that run through SSR (the app store, the settings panel) can read them WITHOUT
 * pulling the `cesium` value bundle into the server graph — Cesium is only ever
 * loaded inside the `ssr:false` globe chunk. Keep this file import-free of cesium.
 */

export type TerrainMode = "ellipsoid" | "world" | "photorealistic";

export const TERRAIN_MODES: TerrainMode[] = ["ellipsoid", "world", "photorealistic"];

/** True when an ion token is configured (build-time inlined NEXT_PUBLIC var). */
export function ionTokenPresent(): boolean {
  const t = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  return typeof t === "string" && t.trim().length > 0;
}
