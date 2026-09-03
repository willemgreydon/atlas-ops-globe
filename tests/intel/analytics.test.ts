import { describe, it, expect } from "vitest";
import { normalize, pearson, scoreCountries, buildInsights, type CountrySignals } from "@/lib/intel/analytics";

const sig = (over: Partial<CountrySignals>): CountrySignals => ({
  iso2: "XX", name: "X", conflict: 0, disaster: 0, severeEvents: 0, eventsRecent: 0,
  news: 0, newsRecent: 0, gdp: null, reachPop: 0, cities: 0, space: 0, ...over,
});

describe("normalize", () => {
  it("min-max scales to 0..1", () => {
    expect(normalize([10, 20, 30])).toEqual([0, 0.5, 1]);
  });
  it("returns flat 0 for a degenerate range", () => {
    expect(normalize([5, 5, 5])).toEqual([0, 0, 0]);
    expect(normalize([])).toEqual([]);
  });
});

describe("pearson", () => {
  it("is 1 for a perfect positive linear relation", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6);
  });
  it("is -1 for a perfect inverse relation", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 6);
  });
  it("is 0 when a series is constant or too short", () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
    expect(pearson([1], [1])).toBe(0);
  });
});

describe("scoreCountries", () => {
  const scores = scoreCountries([
    sig({ iso2: "WAR", name: "Warland", conflict: 40, disaster: 10, severeEvents: 30, news: 50, eventsRecent: 35, newsRecent: 40, reachPop: 5_000_000, cities: 20 }),
    sig({ iso2: "CAL", name: "Calmland", conflict: 0, disaster: 0, severeEvents: 0, news: 5, reachPop: 80_000_000, cities: 400, gdp: 900 }),
    sig({ iso2: "MID", name: "Midland", conflict: 5, disaster: 3, severeEvents: 4, news: 20, reachPop: 30_000_000, cities: 120, gdp: 300 }),
  ]);
  const by = (iso: string) => scores.find((s) => s.iso2 === iso)!;

  it("ranks the conflict-heavy country highest risk, the calm one lowest", () => {
    expect(by("WAR").risk).toBeGreaterThan(by("MID").risk);
    expect(by("CAL").risk).toBe(0);
    expect(by("CAL").stability).toBe(100);
  });
  it("gives the big, calm market the highest opportunity", () => {
    expect(by("CAL").opportunity).toBeGreaterThan(by("WAR").opportunity);
  });
  it("bounds every index to 0..100", () => {
    for (const s of scores) for (const k of ["risk", "opportunity", "momentum", "stability"] as const) {
      expect(s[k]).toBeGreaterThanOrEqual(0);
      expect(s[k]).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildInsights", () => {
  const scores = scoreCountries([
    sig({ iso2: "WAR", name: "Warland", conflict: 40, disaster: 10, severeEvents: 30, news: 50, eventsRecent: 35, newsRecent: 40 }),
    sig({ iso2: "CAL", name: "Calmland", news: 5, reachPop: 80_000_000, cities: 400, gdp: 900 }),
  ]);
  const insights = buildInsights({
    scores,
    persons: [{ name: "A Leader", mentions: 60 }],
    organizations: [{ name: "BigCo", mentions: 30 }],
    cyber: { kev: 12, total: 1800, topVendors: [{ vendor: "Acme", count: 5 }] },
    sanctions: { total: 19000, topAuthorities: [{ authority: "OFAC", count: 12000 }] },
    space: [{ country: "US", count: 3000 }],
    markets: [{ symbol: "SPX", name: "S&P 500", changePct: -1.4, assetClass: "index" }],
    correlations: [{ label: "x", r: 0.6 }],
  });

  it("produces ranked insights across all three personas", () => {
    const personas = new Set(insights.map((i) => i.persona));
    expect(personas.has("political")).toBe(true);
    expect(personas.has("finance")).toBe(true);
    expect(personas.has("marketing")).toBe(true);
    // Sorted by descending score.
    for (let i = 1; i < insights.length; i++) expect(insights[i - 1].score).toBeGreaterThanOrEqual(insights[i].score);
  });
  it("surfaces the high-risk country as a political risk and the calm market as an opportunity", () => {
    expect(insights.some((i) => i.persona === "political" && i.kind === "risk" && i.title.includes("Warland"))).toBe(true);
    expect(insights.some((i) => i.persona === "marketing" && i.kind === "opportunity" && i.title.includes("Calmland"))).toBe(true);
  });
});
