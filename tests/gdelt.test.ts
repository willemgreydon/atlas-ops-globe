import { describe, expect, it } from "vitest";
import { normalizeGdelt } from "@/lib/providers/gdelt";

const sample = {
  articles: [
    {
      url: "https://ex1.test/a",
      title: "Ukraine and Russia resume grain-corridor talks",
      seendate: "20260826T101500Z",
      domain: "ex1.test",
      sourcecountry: "United States",
    },
    {
      url: "https://ex2.test/b",
      title: "Quarterly earnings beat expectations",
      seendate: "20260826T090000Z",
      domain: "nikkei.test",
      sourcecountry: "Japan", // no country in headline → fall back to source
    },
    {
      url: "https://ex3.test/c",
      title: "Local council debates parking rules",
      seendate: "20260826T080000Z",
      domain: "somewhere.test", // unresolvable → no location, but still a row
    },
  ],
};

describe("GDELT normalization", () => {
  const rows = normalizeGdelt(sample);

  it("keeps every article (never drops rows for lack of geo)", () => {
    expect(rows).toHaveLength(3);
  });

  it("geolocates from the headline subject, not the source country", () => {
    const ua = rows[0];
    expect(ua.countryCode).toBe("UA");
    expect(ua.location).toBeDefined();
    expect(Number.isFinite(ua.location!.lat)).toBe(true);
    expect(Number.isFinite(ua.location!.lon)).toBe(true);
  });

  it("falls back to the source country when the headline names none", () => {
    expect(rows[1].countryCode).toBe("JP");
    expect(rows[1].location).toBeDefined();
  });

  it("leaves location undefined when nothing resolves (honest, not invented)", () => {
    expect(rows[2].location).toBeUndefined();
  });

  it("normalizes the seendate to ISO-8601 and carries provenance", () => {
    expect(rows[0].publishedAt).toBe("2026-08-26T10:15:00Z");
    expect(rows[0].provenance?.provider).toBe("gdelt");
  });

  it("parses an empty/absent article list to an empty array", () => {
    expect(normalizeGdelt({})).toEqual([]);
  });
});
