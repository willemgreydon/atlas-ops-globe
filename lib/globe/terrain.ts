/**
 * Surface / terrain controller (mission §9 §122 — premium basemap).
 *
 * Everything here is gated behind a Cesium ion token
 * (`NEXT_PUBLIC_CESIUM_ION_TOKEN`). With no token the globe stays exactly as it
 * is today — a smooth ellipsoid with the OSM raster — and none of this code
 * touches the scene beyond the (identical) ellipsoid default. With a token the
 * user can switch between:
 *
 *  - `ellipsoid`      — the current flat globe (free, always available),
 *  - `world`          — Cesium World Terrain: real elevation relief (ion asset 1),
 *  - `photorealistic` — Google Photorealistic 3D Tiles: textured 3D cities and
 *                       landscape mesh (ion-hosted; usage is billed by Google).
 *
 * The controller is defensive: every ion load is wrapped so a bad/expired token
 * or a network failure falls back to the ellipsoid instead of killing the render
 * loop, and a monotonic generation guard discards a slow load whose mode was
 * already superseded by a newer selection.
 */
import {
  Cesium3DTileset,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  createGooglePhotorealistic3DTileset,
  createWorldTerrainAsync,
  type Viewer,
} from "cesium";
import { type TerrainMode, ionTokenPresent } from "./terrain-config";

export { TERRAIN_MODES, ionTokenPresent, type TerrainMode } from "./terrain-config";

export class TerrainController {
  private viewer: Viewer;
  private ellipsoid = new EllipsoidTerrainProvider();
  private worldTerrain?: CesiumTerrainProvider;
  private tileset?: Cesium3DTileset;
  /** Bumped on every apply()/dispose() so a resolved async load can tell if it
   *  was superseded before it finished. */
  private gen = 0;
  private applied: TerrainMode = "ellipsoid";

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  get mode(): TerrainMode {
    return this.applied;
  }

  /** Switch the surface. Safe to call repeatedly; providers are cached. */
  async apply(requested: TerrainMode): Promise<void> {
    // Hard gate: without a token, only the ellipsoid is reachable.
    const mode: TerrainMode = ionTokenPresent() ? requested : "ellipsoid";
    const myGen = ++this.gen;

    try {
      if (mode === "photorealistic") {
        if (!this.tileset) {
          const ts = await createGooglePhotorealistic3DTileset();
          if (myGen !== this.gen) { ts.destroy(); return; } // superseded mid-load
          this.tileset = ts;
          this.viewer.scene.primitives.add(ts);
        }
        this.tileset.show = true;
        // The tiles carry their own geometry + imagery: hide the base globe so
        // it doesn't z-fight or peek through, and keep an ellipsoid terrain.
        this.viewer.scene.globe.show = false;
        this.viewer.terrainProvider = this.ellipsoid;
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
      } else if (mode === "world") {
        if (!this.worldTerrain) {
          const t = await createWorldTerrainAsync({ requestVertexNormals: true });
          if (myGen !== this.gen) return; // superseded mid-load
          this.worldTerrain = t;
        }
        if (this.tileset) this.tileset.show = false;
        this.viewer.scene.globe.show = true;
        this.viewer.terrainProvider = this.worldTerrain;
        // Real relief should occlude — markers opt out via disableDepthTestDistance.
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
      } else {
        if (this.tileset) this.tileset.show = false;
        this.viewer.scene.globe.show = true;
        this.viewer.terrainProvider = this.ellipsoid;
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
      }
      if (myGen === this.gen) this.applied = mode;
    } catch (err) {
      // Bad token, quota, or network failure — never take the render loop down.
      console.warn(`[terrain] failed to apply "${mode}", falling back to ellipsoid:`, err);
      if (myGen === this.gen) {
        if (this.tileset) this.tileset.show = false;
        this.viewer.scene.globe.show = true;
        this.viewer.terrainProvider = this.ellipsoid;
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
        this.applied = "ellipsoid";
      }
    }
  }

  dispose(): void {
    this.gen++; // cancel any in-flight apply()
    if (!this.viewer.isDestroyed()) {
      if (this.tileset) this.viewer.scene.primitives.remove(this.tileset); // removes + destroys
      this.viewer.scene.globe.show = true;
      this.viewer.terrainProvider = this.ellipsoid;
    }
    this.tileset = undefined;
  }
}
