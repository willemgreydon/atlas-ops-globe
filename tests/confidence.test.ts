import { describe, expect, it } from "vitest";
import { scoreConfidence } from "@/lib/core/confidence";

describe("confidence engine", () => {
  it("returns a 0..1 score with explainable factors", () => {
    const r = scoreConfidence({ sourceCount: 3, providerReliability: 0.9, geoPrecision: 0.9 });
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.factors.length).toBeGreaterThan(2);
  });

  it("rewards corroboration", () => {
    const one = scoreConfidence({ sourceCount: 1, providerReliability: 0.8 });
    const many = scoreConfidence({ sourceCount: 5, providerReliability: 0.8 });
    expect(many.score).toBeGreaterThan(one.score);
  });

  it("penalizes conflicting sources", () => {
    const clean = scoreConfidence({ sourceCount: 2, providerReliability: 0.8, geoPrecision: 0.8 });
    const conflict = scoreConfidence({ sourceCount: 2, providerReliability: 0.8, geoPrecision: 0.8, conflictingSources: true });
    expect(conflict.score).toBeLessThan(clean.score);
  });

  it("decays with staleness", () => {
    const fresh = scoreConfidence({ ageSeconds: 1, freshnessSlaSeconds: 60 });
    const stale = scoreConfidence({ ageSeconds: 120, freshnessSlaSeconds: 60 });
    expect(fresh.score).toBeGreaterThan(stale.score);
  });
});
