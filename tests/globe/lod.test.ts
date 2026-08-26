import { describe, expect, it } from "vitest";
import { bandForHeight, layerVisibleAt, pickLabelBudget, LOD_POLICY } from "@/lib/globe/lod";

describe("lod: altitude bands", () => {
  it("classifies camera height into the documented bands", () => {
    expect(bandForHeight(20_000)).toBe("city"); // < 60 km
    expect(bandForHeight(200_000)).toBe("regional"); // 60–400 km
    expect(bandForHeight(1_000_000)).toBe("country"); // 400–2 000 km
    expect(bandForHeight(5_000_000)).toBe("continent"); // 2 000–8 000 km
    expect(bandForHeight(20_000_000)).toBe("orbit"); // > 8 000 km
  });

  it("descends monotonically as the camera drops (near = higher detail)", () => {
    const order = ["orbit", "continent", "country", "regional", "city"];
    const heights = [20_000_000, 5_000_000, 1_000_000, 200_000, 20_000];
    expect(heights.map(bandForHeight)).toEqual(order);
  });

  it("treats a non-finite height as orbit (the safe, coarsest band)", () => {
    expect(bandForHeight(Infinity)).toBe("orbit");
    expect(bandForHeight(NaN)).toBe("orbit");
  });
});

describe("lod: layer visibility", () => {
  it("hides fine ground layers from orbit but keeps them up close", () => {
    // weather + news are gated at the CONTINENT ceiling (8 000 km).
    expect(layerVisibleAt("weather", 20_000_000)).toBe(false);
    expect(layerVisibleAt("weather", 500_000)).toBe(true);
    expect(layerVisibleAt("news", 20_000_000)).toBe(false);
    expect(layerVisibleAt("news", 500_000)).toBe(true);
  });

  it("keeps ungated layers visible at every altitude", () => {
    for (const h of [10_000, 1_000_000, 50_000_000]) {
      expect(layerVisibleAt("satellites", h)).toBe(true);
      expect(layerVisibleAt("countries", h)).toBe(true);
      expect(layerVisibleAt("events", h)).toBe(true);
      expect(layerVisibleAt("aircraft", h)).toBe(true);
    }
  });

  it("uses the policy's exact maxHeight as the inclusive boundary", () => {
    const max = LOD_POLICY.weather!.maxHeight!;
    expect(layerVisibleAt("weather", max)).toBe(true); // at the ceiling: visible
    expect(layerVisibleAt("weather", max + 1)).toBe(false); // one metre past: hidden
  });
});

describe("lod: label budget", () => {
  const items = [
    { id: "a", distance: 300 },
    { id: "b", distance: 100 },
    { id: "c", distance: 200 },
    { id: "d", distance: 400 },
  ];

  it("keeps the nearest N labels and drops the rest", () => {
    const shown = pickLabelBudget(items, 2);
    expect(shown).toEqual(new Set(["b", "c"]));
  });

  it("shows everything when under budget", () => {
    expect(pickLabelBudget(items, 10)).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("hides everything at a zero budget", () => {
    expect(pickLabelBudget(items, 0).size).toBe(0);
  });

  it("breaks distance ties deterministically by id (no flicker)", () => {
    const tied = [
      { id: "z", distance: 100 },
      { id: "a", distance: 100 },
      { id: "m", distance: 100 },
    ];
    expect(pickLabelBudget(tied, 2)).toEqual(new Set(["a", "m"]));
  });
});
