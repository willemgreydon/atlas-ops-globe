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

import { describe as descStats, zScores, percentileRanks, gini, hhi, cosineSimilarity, correlationMatrix, paretoFrontier, kMeans, weightedScore } from "@/lib/intel/analytics";

describe("math toolkit", () => {
  it("describe: mean/median/std/quartiles", () => {
    const s = descStats([1, 2, 3, 4, 5]);
    expect(s.mean).toBe(3);
    expect(s.median).toBe(3);
    expect(s.std).toBeCloseTo(Math.sqrt(2), 6);
    expect(s.q1).toBe(2); expect(s.q3).toBe(4);
    expect(descStats([]).n).toBe(0);
  });
  it("zScores: standardised, 0 when flat", () => {
    const z = zScores([1, 2, 3, 4, 5]);
    expect(z[2]).toBeCloseTo(0, 6);
    expect(z[4]).toBeCloseTo(Math.sqrt(2), 6);
    expect(zScores([7, 7, 7])).toEqual([0, 0, 0]);
  });
  it("percentileRanks: top value is 100", () => {
    const p = percentileRanks([10, 20, 30, 40]);
    expect(p[3]).toBe(100);
    expect(p[0]).toBe(25);
  });
  it("gini: 0 for equal, high for concentrated", () => {
    expect(gini([5, 5, 5, 5])).toBeCloseTo(0, 6);
    expect(gini([0, 0, 0, 100])).toBeGreaterThan(0.6);
  });
  it("hhi: ~0 fragmented, 1 monopoly", () => {
    expect(hhi([1, 1, 1, 1])).toBeCloseTo(0, 6);
    expect(hhi([100])).toBe(1);
    expect(hhi([90, 5, 5])).toBeGreaterThan(0.5);
  });
  it("cosineSimilarity: 1 parallel, 0 orthogonal", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it("correlationMatrix: symmetric with unit diagonal", () => {
    const { keys, matrix } = correlationMatrix({ a: [1, 2, 3], b: [3, 2, 1], c: [1, 2, 3] });
    expect(keys).toEqual(["a", "b", "c"]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(-1, 2);
    expect(matrix[0][2]).toBeCloseTo(1, 2);
    expect(matrix[0][1]).toBe(matrix[1][0]);
  });
  it("paretoFrontier: keeps only non-dominated (maximise both)", () => {
    const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }, { x: 1, y: 3 }];
    const f = paretoFrontier(pts).sort();
    expect(f).toContain(1); // (2,2) dominates (1,1)
    expect(f).toContain(2); // (3,1) non-dominated on x
    expect(f).toContain(3); // (1,3) non-dominated on y
    expect(f).not.toContain(0); // (1,1) dominated
  });
  it("kMeans: separates two clusters deterministically", () => {
    const pts = [[0, 0], [0.2, 0.1], [10, 10], [10.1, 9.9]];
    const { assignments } = kMeans(pts, 2);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[2]).toBe(assignments[3]);
    expect(assignments[0]).not.toBe(assignments[2]);
  });
  it("weightedScore: normalised weighted blend → 0..100", () => {
    expect(weightedScore({ a: 1, b: 0 }, { a: 1, b: 1 })).toBe(50);
    expect(weightedScore({ a: 1, b: 1 }, { a: 2, b: 1 })).toBe(100);
  });
});
