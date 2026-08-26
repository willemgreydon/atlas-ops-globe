import { describe, it, expect } from "vitest";
import { classifyFreshness, newestTimestamp, freshnessFor, attachFreshness } from "@/lib/intel/freshness";

const NOW = Date.parse("2026-08-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

describe("classifyFreshness", () => {
  it("is domain-specific: markets go stale in minutes, quakes tolerate hours", () => {
    expect(classifyFreshness(NOW - 2 * MIN, "markets", NOW)).toBe("fresh");
    expect(classifyFreshness(NOW - 20 * MIN, "markets", NOW)).toBe("aging");
    expect(classifyFreshness(NOW - 3 * HOUR, "markets", NOW)).toBe("stale");
    // Same 3-hour age is still fresh for a disaster feed.
    expect(classifyFreshness(NOW - 3 * HOUR, "disaster", NOW)).toBe("fresh");
  });

  it("uses TLE-epoch tolerances (days) for the space domain", () => {
    expect(classifyFreshness(NOW - 1 * DAY, "space", NOW)).toBe("fresh");
    expect(classifyFreshness(NOW - 4 * DAY, "space", NOW)).toBe("aging");
    expect(classifyFreshness(NOW - 10 * DAY, "space", NOW)).toBe("stale");
  });

  it("returns 'unknown' when there is no timestamp", () => {
    expect(classifyFreshness(null, "news", NOW)).toBe("unknown");
    expect(classifyFreshness(NaN, "news", NOW)).toBe("unknown");
  });
});

describe("newestTimestamp", () => {
  it("finds the newest parseable timestamp and ignores junk", () => {
    const rows = [{ t: ago(5 * HOUR) }, { t: ago(1 * HOUR) }, { t: "not-a-date" }, { t: null }];
    expect(newestTimestamp(rows, "t")).toBe(NOW - 1 * HOUR);
  });
  it("returns null for an empty/unparseable set", () => {
    expect(newestTimestamp([], "t")).toBeNull();
    expect(newestTimestamp([{ t: null }], "t")).toBeNull();
  });
});

describe("freshnessFor / attachFreshness", () => {
  it("attaches freshness alongside the original result shape", () => {
    // attachFreshness classifies against the real clock, so anchor the row to it.
    const recent = new Date(Date.now() - 30 * MIN).toISOString();
    const result = { data: [{ observedAt: recent }], page: { count: 1 } };
    const out = attachFreshness(result, "weather", "observedAt");
    expect(out.page).toEqual({ count: 1 }); // original fields preserved
    expect(out.freshness.domain).toBe("weather");
    expect(out.freshness.state).toBe("fresh"); // 30m < 90m aging threshold
  });

  it("classifies weather age correctly", () => {
    const f = freshnessFor([{ observedAt: ago(2 * HOUR) }], "weather", "observedAt", NOW);
    expect(f.state).toBe("aging");
    expect(f.latestObservedAt).toBe(ago(2 * HOUR));
    expect(f.ageMs).toBe(2 * HOUR);
  });

  it("reports 'unknown' with null fields for an empty page", () => {
    const f = freshnessFor([], "news", "publishedAt", NOW);
    expect(f.state).toBe("unknown");
    expect(f.latestObservedAt).toBeNull();
    expect(f.ageMs).toBeNull();
  });
});
