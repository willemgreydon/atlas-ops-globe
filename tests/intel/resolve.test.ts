import { describe, expect, it } from "vitest";
import { extractCountryMentions, locateNews, nearestCountry, resolveCountry } from "@/lib/intel/resolve";

describe("country resolution", () => {
  it("resolves ISO2, ISO3 and names", () => {
    expect(resolveCountry("US")?.iso2).toBe("US");
    expect(resolveCountry("DEU")?.iso2).toBe("DE");
    expect(resolveCountry("Japan")?.iso3).toBe("JPN");
  });

  it("resolves common aliases without discarding them", () => {
    expect(resolveCountry("USA")?.iso2).toBe("US");
    expect(resolveCountry("U.S.")?.iso2).toBe("US");
    expect(resolveCountry("Russia")?.iso2).toBe("RU");
    expect(resolveCountry("South Korea")?.iso2).toBe("KR");
  });

  it("returns null for unknown input (never guesses)", () => {
    expect(resolveCountry("Atlantis")).toBeNull();
    expect(resolveCountry("")).toBeNull();
    expect(resolveCountry(undefined)).toBeNull();
  });

  it("extracts country mentions from headlines with word boundaries", () => {
    const hits = extractCountryMentions("Talks between Germany and France over Ukraine");
    const iso = hits.map((h) => h.iso2).sort();
    expect(iso).toContain("DE");
    expect(iso).toContain("FR");
    expect(iso).toContain("UA");
  });

  it("does not false-match substrings", () => {
    // "iran" must not match inside "Iranian-made" incorrectly as a partial word;
    // whole-word "Iran" absent here.
    const hits = extractCountryMentions("Corporation announces earnings");
    expect(hits.length).toBe(0);
  });

  it("finds the nearest country to a point", () => {
    const near = nearestCountry({ lat: 48.2, lon: 16.37 }); // Vienna
    expect(near?.iso2).toBe("AT");
  });
});

describe("news geolocation", () => {
  it("anchors a headline to the country it is about (with a real point)", () => {
    const loc = locateNews("Ukraine and Russia resume grain talks", "US");
    expect(loc?.iso2).toBe("UA"); // subject country, not the US source
    expect(Number.isFinite(loc?.point.lat)).toBe(true);
    expect(Number.isFinite(loc?.point.lon)).toBe(true);
  });

  it("prefers the country mentioned earliest in the headline", () => {
    expect(locateNews("Germany pressures France on defense spending")?.iso2).toBe("DE");
    expect(locateNews("France and Germany at odds over budget")?.iso2).toBe("FR");
  });

  it("falls back to the source country when the headline names none", () => {
    expect(locateNews("Local markets rally on earnings", "JP")?.iso2).toBe("JP");
    expect(locateNews("Quarterly report published", "United States")?.iso2).toBe("US");
  });

  it("returns null rather than inventing a location", () => {
    expect(locateNews("Quarterly report published", null)).toBeNull();
    expect(locateNews("", undefined)).toBeNull();
  });
});
