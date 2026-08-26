/**
 * Globe render-quality presets (mission §3).
 *
 * A preset is a *declarative* bundle of every knob that trades visual fidelity
 * for frame budget. The scene configurator (`scene.ts`) applies it; the
 * performance governor (`performance.ts`) may temporarily *degrade* the live
 * preset (never the user's chosen ceiling) when FPS drops.
 *
 * Presets deliberately do NOT request enormous internal resolutions. We use the
 * device pixel ratio as a base and clamp the multiplier (mission §71/§3).
 */

export type GlobeQuality = "performance" | "balanced" | "high" | "ultra";

export const GLOBE_QUALITIES: GlobeQuality[] = ["performance", "balanced", "high", "ultra"];

export interface QualitySettings {
  /** Multiplier applied on top of a DPR base to get `viewer.resolutionScale`. */
  resolutionScale: number;
  /** Hard cap on resolutionScale × devicePixelRatio, so 4K panels stay sane. */
  maxPixelRatio: number;
  /** MSAA sample count (1 = off). Cesium `scene.msaaSamples`. */
  msaaSamples: number;
  /** Post-process FXAA. */
  fxaa: boolean;
  /** Terrain screen-space error — lower = more detail = more tiles. */
  maximumScreenSpaceError: number;
  /** Cesium tile cache size (tiles kept in memory). */
  tileCacheSize: number;
  /** Imagery anisotropic filtering. */
  anisotropy: number;
  /** Ground + sky atmosphere scattering. */
  atmosphere: boolean;
  /** Terrain/day-night lighting on the globe. */
  lighting: boolean;
  /** Low-altitude fog for depth (mission §102). */
  fog: boolean;
  /** Cheap dynamic ambient-occlusion-ish shadows. */
  shadows: boolean;
  /** Ceiling on simultaneously visible labels (label manager, §64). */
  maxLabels: number;
  /** Ceiling on active particle systems (§37/§126). */
  maxParticleSystems: number;
  /** Trail sample retention for moving entities (§22/§77). */
  trailSamples: number;
  /** Altitude (m) below which glTF models may replace billboards (§85). */
  modelSwapAltitude: number;
}

export const QUALITY_PRESETS: Record<GlobeQuality, QualitySettings> = {
  performance: {
    resolutionScale: 0.75,
    maxPixelRatio: 1,
    msaaSamples: 1,
    fxaa: false,
    maximumScreenSpaceError: 4,
    tileCacheSize: 100,
    anisotropy: 1,
    atmosphere: true,
    lighting: false,
    fog: false,
    shadows: false,
    maxLabels: 40,
    maxParticleSystems: 0,
    trailSamples: 16,
    modelSwapAltitude: 0,
  },
  balanced: {
    resolutionScale: 1,
    maxPixelRatio: 1.5,
    msaaSamples: 1,
    fxaa: true,
    maximumScreenSpaceError: 2.5,
    tileCacheSize: 200,
    anisotropy: 4,
    atmosphere: true,
    lighting: true,
    fog: true,
    shadows: false,
    maxLabels: 80,
    maxParticleSystems: 2,
    trailSamples: 48,
    modelSwapAltitude: 120_000,
  },
  high: {
    resolutionScale: 1,
    maxPixelRatio: 2,
    msaaSamples: 4,
    fxaa: true,
    maximumScreenSpaceError: 2,
    tileCacheSize: 400,
    anisotropy: 8,
    atmosphere: true,
    lighting: true,
    fog: true,
    shadows: false,
    maxLabels: 140,
    maxParticleSystems: 6,
    trailSamples: 96,
    modelSwapAltitude: 200_000,
  },
  ultra: {
    resolutionScale: 1,
    maxPixelRatio: 2,
    msaaSamples: 8,
    fxaa: true,
    maximumScreenSpaceError: 1.5,
    tileCacheSize: 800,
    anisotropy: 16,
    atmosphere: true,
    lighting: true,
    fog: true,
    shadows: true,
    maxLabels: 240,
    maxParticleSystems: 12,
    trailSamples: 160,
    modelSwapAltitude: 350_000,
  },
};

/** Ordered degradation ladder used by the performance governor (best → worst). */
export const DEGRADE_LADDER: GlobeQuality[] = ["ultra", "high", "balanced", "performance"];

/**
 * Effective pixel ratio for a preset given the device. Never exceeds the
 * device's own DPR (super-sampling beyond native is opt-in only, §71).
 */
export function effectivePixelRatio(q: QualitySettings, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, q.maxPixelRatio) * q.resolutionScale;
}

/** Pick a sensible default preset from coarse hardware hints (no benchmark yet). */
export function autoDetectQuality(): GlobeQuality {
  if (typeof navigator === "undefined") return "high";
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile || mem <= 4 || cores <= 4) return "performance";
  if (mem <= 8 || cores <= 8) return "balanced";
  return "high";
}
