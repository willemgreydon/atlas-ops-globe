import { describe, expect, it } from "vitest";
import { deadReckon, secondsSince } from "@/lib/globe/render/motion";

describe("deadReckon", () => {
  it("returns the input when speed or heading is missing", () => {
    expect(deadReckon(10, 50, undefined, 200, 10, 30)).toEqual({ lon: 10, lat: 50 });
    expect(deadReckon(10, 50, 90, undefined, 10, 30)).toEqual({ lon: 10, lat: 50 });
    expect(deadReckon(10, 50, 90, 0, 10, 30)).toEqual({ lon: 10, lat: 50 });
  });

  it("moves due north for heading 0", () => {
    // 100 m/s for 10 s = 1000 m north ≈ 0.00898° lat, no lon change.
    const p = deadReckon(10, 0, 0, 100, 10, 60);
    expect(p.lon).toBeCloseTo(10, 6);
    expect(p.lat).toBeGreaterThan(0);
    expect(p.lat).toBeCloseTo(1000 / 111320, 4);
  });

  it("moves due east for heading 90", () => {
    const p = deadReckon(10, 0, 90, 100, 10, 60);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lon).toBeGreaterThan(10);
  });

  it("clamps extrapolation to maxSeconds (never invents far trajectory)", () => {
    const capped = deadReckon(10, 0, 0, 100, 10_000, 30); // asks for 10000 s, cap 30
    const at30 = deadReckon(10, 0, 0, 100, 30, 30);
    expect(capped.lat).toBeCloseTo(at30.lat, 9);
  });
});

describe("secondsSince", () => {
  it("is 0 for missing or unparseable timestamps", () => {
    expect(secondsSince(undefined)).toBe(0);
    expect(secondsSince("not-a-date")).toBe(0);
  });

  it("is non-negative for past timestamps and 0 for the future", () => {
    const past = new Date(Date.now() - 5000).toISOString();
    expect(secondsSince(past)).toBeGreaterThanOrEqual(4);
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(secondsSince(future)).toBe(0);
  });
});
