import { describe, expect, it } from "vitest";
import {
  DEGRADE_LADDER,
  GLOBE_QUALITIES,
  QUALITY_PRESETS,
  effectivePixelRatio,
} from "@/lib/globe/quality";

describe("globe quality presets", () => {
  it("defines a preset for every quality level", () => {
    for (const q of GLOBE_QUALITIES) expect(QUALITY_PRESETS[q]).toBeDefined();
  });

  it("orders the degrade ladder best → worst by fidelity", () => {
    expect(DEGRADE_LADDER).toEqual(["ultra", "high", "balanced", "performance"]);
    // Screen-space error is monotonically non-decreasing as quality drops
    // (higher SSE = fewer tiles = lower fidelity).
    const sse = DEGRADE_LADDER.map((q) => QUALITY_PRESETS[q].maximumScreenSpaceError);
    for (let i = 1; i < sse.length; i++) expect(sse[i]).toBeGreaterThanOrEqual(sse[i - 1]);
  });

  it("never super-samples beyond the device pixel ratio", () => {
    // Even on a 3× panel at ultra (cap 2×), effective PR must not exceed DPR.
    const eff = effectivePixelRatio(QUALITY_PRESETS.ultra, 3);
    expect(eff).toBeLessThanOrEqual(3);
    expect(eff).toBe(2); // min(3, cap=2) × scale=1
  });

  it("clamps performance preset below 1× on a standard panel", () => {
    // performance: cap 1, scale 0.75 → 0.75× on a 1× display (down-sampled).
    expect(effectivePixelRatio(QUALITY_PRESETS.performance, 1)).toBeCloseTo(0.75);
    // On a 2× panel, cap 1 still holds → 0.75×.
    expect(effectivePixelRatio(QUALITY_PRESETS.performance, 2)).toBeCloseTo(0.75);
  });
});
