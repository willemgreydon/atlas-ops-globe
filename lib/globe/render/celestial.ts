/**
 * Celestial environment (mission §8 §148 — Phase B "Earth in space").
 *
 * Turns the flat void behind the globe into a physically-grounded deep-space
 * backdrop: the real Tycho-2 star catalogue skybox (bundled with Cesium, loaded
 * offline from `/cesium/Assets/Textures/SkyBox`), the sun and moon as lit
 * bodies, plus two restrained HDR post-process passes — a soft bloom on the
 * bright limb/sun and a camera lens-flare when the sun is in frame.
 *
 * Everything here is quality-gated: bloom + lens flare are the first passes the
 * performance governor should never have to fight, so they only arm on
 * `balanced` and above and read the same `QualitySettings` the scene uses. The
 * effect is cinematic, not sci-fi — no neon, no fake glow (mission §127).
 */
import {
  PostProcessStageLibrary,
  SkyBox,
  type PostProcessStage,
  type Viewer,
} from "cesium";
import type { QualitySettings } from "../quality";

export interface CelestialConfig {
  /** Master toggle — user can drop back to a plain black background. */
  enabled: boolean;
  quality: QualitySettings;
}

/**
 * Owns the celestial bodies + HDR post-process passes for one viewer. Idempotent
 * `configure()` mirrors `configureScene` so React can re-drive it on any change.
 */
export class CelestialEnvironment {
  private viewer: Viewer;
  private lensFlare?: PostProcessStage;
  private starBox?: SkyBox;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  configure(config: CelestialConfig): void {
    const scene = this.viewer.scene;
    const { enabled, quality } = config;

    // --- stars, sun, moon ---------------------------------------------------
    // Guarantee a real star skybox rather than relying on the widget default,
    // so the backdrop survives scene resets. `createEarthSkyBox` points at the
    // bundled Tycho-2 cube map.
    if (!this.starBox) this.starBox = SkyBox.createEarthSkyBox();
    if (scene.skyBox !== this.starBox) scene.skyBox = this.starBox;
    this.starBox.show = enabled;
    if (scene.sun) scene.sun.show = enabled;
    if (scene.moon) scene.moon.show = enabled;

    // --- HDR post-process: bloom + lens flare -------------------------------
    // Both cost real fill-rate, so they follow the particle budget (a proxy for
    // "this GPU has headroom", 0 on performance) AND the HDR tonemapping that
    // `configureScene` owns from the atmosphere preset — we read it, never fight
    // it. So bloom/flare arm only under a cinematic-capable scene.
    const wantPost = enabled && quality.maxParticleSystems > 0 && scene.highDynamicRange;

    const bloom = scene.postProcessStages.bloom;
    bloom.enabled = wantPost;
    if (wantPost) {
      bloom.uniforms.glowOnly = false;
      bloom.uniforms.contrast = 128;
      bloom.uniforms.brightness = -0.35;
      bloom.uniforms.delta = 1.0;
      bloom.uniforms.sigma = 3.0;
      bloom.uniforms.stepSize = 1.0;
    }

    if (wantPost) {
      if (!this.lensFlare) {
        this.lensFlare = PostProcessStageLibrary.createLensFlareStage();
        scene.postProcessStages.add(this.lensFlare);
      }
      this.lensFlare.enabled = true;
      const u = this.lensFlare.uniforms as {
        intensity: number; distortion: number; ghostDispersal: number;
        haloWidth: number; dirtAmount: number;
      };
      u.intensity = 2.2;
      u.distortion = 8.0;
      u.ghostDispersal = 0.32;
      u.haloWidth = 0.4;
      u.dirtAmount = 0.28;
    } else if (this.lensFlare) {
      this.lensFlare.enabled = false;
    }
  }

  dispose(): void {
    const scene = this.viewer.scene;
    if (this.lensFlare && !scene.isDestroyed()) {
      scene.postProcessStages.remove(this.lensFlare);
    }
    this.lensFlare = undefined;
    // The star box is owned by the scene; leave it in place for teardown safety.
    this.starBox = undefined;
  }
}
