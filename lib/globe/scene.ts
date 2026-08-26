/**
 * Cinematic scene configuration (mission §5 §6 §7 §8 §102).
 *
 * One imperative pass that turns the default Cesium scene into a premium,
 * physically-plausible Earth: tuned Rayleigh/Mie scattering, restrained
 * ground-atmosphere haze, dynamic day/night lighting driven by real sun
 * position, and depth-cue fog — all gated by the active quality preset.
 *
 * Deliberately NOT sci-fi: no neon glow, no grids. Every knob here maps to a
 * physical light-transport parameter (mission §127 §128).
 */
import {
  Cartesian3,
  Color,
  DynamicAtmosphereLightingType,
  JulianDate,
  type Scene,
  type Viewer,
} from "cesium";
import type { GlobeQuality, QualitySettings } from "./quality";
import { QUALITY_PRESETS, effectivePixelRatio } from "./quality";

/** Atmosphere character presets (mission §7). */
export type AtmospherePreset = "scientific" | "natural" | "cinematic" | "minimal";

/** Lighting model for the globe (mission §6). */
export type LightingMode = "realtime-sun" | "timeline-sun" | "flat-analytical";

interface AtmosphereTuning {
  /** Ground-atmosphere Rayleigh scattering coefficient (blue-sky term). */
  rayleigh: Cartesian3;
  mie: Cartesian3;
  rayleighScaleHeight: number;
  mieScaleHeight: number;
  mieAnisotropy: number;
  groundLightIntensity: number;
  skyLightIntensity: number;
  saturationShift: number;
  brightnessShift: number;
  /** Restrained bloom-ish HDR toggle. */
  hdr: boolean;
}

// Physically-inspired defaults. Rayleigh ~ (5.8, 13.5, 33.1)e-6 in real units;
// Cesium expects small positive coefficients, so we scale to the engine's range.
const ATMOSPHERE: Record<AtmospherePreset, AtmosphereTuning> = {
  scientific: {
    rayleigh: new Cartesian3(5.8e-6, 13.5e-6, 33.1e-6),
    mie: new Cartesian3(21e-6, 21e-6, 21e-6),
    rayleighScaleHeight: 8000,
    mieScaleHeight: 3200,
    mieAnisotropy: 0.9,
    groundLightIntensity: 10,
    skyLightIntensity: 50,
    saturationShift: 0,
    brightnessShift: 0,
    hdr: false,
  },
  natural: {
    rayleigh: new Cartesian3(5.8e-6, 13.5e-6, 33.1e-6),
    mie: new Cartesian3(21e-6, 21e-6, 21e-6),
    rayleighScaleHeight: 10000,
    mieScaleHeight: 3200,
    mieAnisotropy: 0.9,
    groundLightIntensity: 12,
    skyLightIntensity: 55,
    saturationShift: 0.02,
    brightnessShift: 0.0,
    hdr: true,
  },
  cinematic: {
    rayleigh: new Cartesian3(6.2e-6, 14.2e-6, 34.5e-6),
    mie: new Cartesian3(24e-6, 24e-6, 24e-6),
    rayleighScaleHeight: 11000,
    mieScaleHeight: 3400,
    mieAnisotropy: 0.92,
    groundLightIntensity: 14,
    skyLightIntensity: 65,
    saturationShift: 0.08,
    brightnessShift: 0.03,
    hdr: true,
  },
  minimal: {
    rayleigh: new Cartesian3(5.8e-6, 13.5e-6, 33.1e-6),
    mie: new Cartesian3(21e-6, 21e-6, 21e-6),
    rayleighScaleHeight: 8000,
    mieScaleHeight: 3200,
    mieAnisotropy: 0.9,
    groundLightIntensity: 8,
    skyLightIntensity: 40,
    saturationShift: -0.1,
    brightnessShift: -0.05,
    hdr: false,
  },
};

export interface SceneConfig {
  quality: GlobeQuality;
  atmosphere: AtmospherePreset;
  lighting: LightingMode;
}

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  quality: "high",
  atmosphere: "natural",
  lighting: "realtime-sun",
};

/**
 * Apply the full cinematic scene configuration. Idempotent — safe to call again
 * when the quality preset, atmosphere preset or lighting mode changes.
 */
export function configureScene(viewer: Viewer, config: SceneConfig): void {
  const scene = viewer.scene;
  const q = QUALITY_PRESETS[config.quality];
  applyQuality(viewer, q, config.quality);
  applyAtmosphere(scene, config.atmosphere, q);
  applyLighting(viewer, config.lighting, q);

  // Deep-space backdrop; the globe base peeks through only where imagery is absent.
  scene.globe.baseColor = Color.fromCssColorString("#0a1016");
  scene.backgroundColor = Color.fromCssColorString("#05070a");
  // `depthTestAgainstTerrain` is owned by the TerrainController (`terrain.ts`),
  // which sets it per surface mode (on for real relief, off for the ellipsoid),
  // so it isn't reset here on every quality/atmosphere change.
}

/** Resolution, MSAA, FXAA, terrain SSE, fog — the frame-budget knobs. */
export function applyQuality(viewer: Viewer, q: QualitySettings, quality: GlobeQuality): void {
  const scene = viewer.scene;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  viewer.resolutionScale = effectivePixelRatio(q, dpr) / dpr;
  try {
    scene.msaaSamples = q.msaaSamples;
  } catch {
    /* MSAA unsupported on this context — ignore */
  }
  scene.postProcessStages.fxaa.enabled = q.fxaa;
  scene.globe.maximumScreenSpaceError = q.maximumScreenSpaceError;
  scene.globe.tileCacheSize = q.tileCacheSize;

  scene.fog.enabled = q.fog;
  scene.fog.density = 2.0e-4;
  scene.fog.minimumBrightness = 0.03;
  scene.globe.showGroundAtmosphere = q.atmosphere;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = q.atmosphere;
  void quality;
}

function applyAtmosphere(scene: Scene, preset: AtmospherePreset, q: QualitySettings): void {
  const t = ATMOSPHERE[preset];
  const on = q.atmosphere;
  scene.globe.showGroundAtmosphere = on;
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = on;
  scene.highDynamicRange = t.hdr && q.msaaSamples > 1;

  // Ground atmosphere (scene.atmosphere) — the limb haze + horizon glow.
  const a = scene.atmosphere;
  if (a) {
    a.rayleighCoefficient = t.rayleigh;
    a.mieCoefficient = t.mie;
    a.rayleighScaleHeight = t.rayleighScaleHeight;
    a.mieScaleHeight = t.mieScaleHeight;
    a.mieAnisotropy = t.mieAnisotropy;
    a.lightIntensity = t.groundLightIntensity;
    a.saturationShift = t.saturationShift;
    a.brightnessShift = t.brightnessShift;
  }
  // Sky atmosphere (the blue rim seen from orbit).
  const sky = scene.skyAtmosphere;
  if (sky) {
    sky.atmosphereLightIntensity = t.skyLightIntensity;
    sky.atmosphereMieAnisotropy = t.mieAnisotropy;
    sky.saturationShift = t.saturationShift;
    sky.brightnessShift = t.brightnessShift;
  }
}

function applyLighting(viewer: Viewer, mode: LightingMode, q: QualitySettings): void {
  const scene = viewer.scene;
  switch (mode) {
    case "realtime-sun":
      scene.globe.enableLighting = q.lighting;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
      if (scene.atmosphere) scene.atmosphere.dynamicLighting = DynamicAtmosphereLightingType.SUNLIGHT;
      viewer.clock.shouldAnimate = true;
      viewer.clock.currentTime = JulianDate.now();
      break;
    case "timeline-sun":
      // Sun follows viewer.clock (which the time controller drives during replay).
      scene.globe.enableLighting = q.lighting;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
      if (scene.atmosphere) scene.atmosphere.dynamicLighting = DynamicAtmosphereLightingType.SUNLIGHT;
      break;
    case "flat-analytical":
      // Even, shadow-free light so data reads cleanly (analyst mode, §6).
      scene.globe.enableLighting = false;
      scene.globe.dynamicAtmosphereLighting = false;
      if (scene.atmosphere) scene.atmosphere.dynamicLighting = DynamicAtmosphereLightingType.NONE;
      break;
  }
  scene.shadowMap.enabled = q.shadows && mode !== "flat-analytical";
}
