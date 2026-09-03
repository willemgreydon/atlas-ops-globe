import { describe, expect, it } from "vitest";
import { normalizeGdeltConflict } from "@/lib/providers/gdelt-conflict";

const sample = {
  articles: [
    { url: "https://x.test/1", title: "Airstrike kills dozens in Ukraine", seendate: "20260903T101500Z", domain: "x.test", sourcecountry: "Ukraine" },
    // Same incident, same place + lead words → must collapse into the one above.
    { url: "https://x.test/2", title: "Airstrike kills dozens in Ukraine overnight", seendate: "20260903T110000Z", domain: "y.test", sourcecountry: "Ukraine" },
    { url: "https://x.test/3", title: "Massacre reported in Russia", seendate: "20260903T090000Z", domain: "z.test", sourcecountry: "Russia" },
    // No conflict/intensity words, but geolocates (source country) → kept as watch.
    { url: "https://x.test/4", title: "Trade ministers hold annual summit", seendate: "20260903T080000Z", domain: "q.test", sourcecountry: "Japan" },
    // Nothing resolves → conflict needs a position, so it is dropped (not invented).
    { url: "https://x.test/5", title: "Clashes reported in the capital", seendate: "20260903T070000Z", domain: "r.test" },
  ],
};

describe("GDELT conflict normalization", () => {
  const rows = normalizeGdeltConflict(sample);

  it("keeps only geolocated events and de-dups repeat reporting", () => {
    // 5 in → article 1&2 collapse, article 5 dropped (no geo) → 3 out.
    expect(rows).toHaveLength(3);
    expect(rows.every((e) => e.kind === "conflict")).toBe(true);
    expect(rows.every((e) => Number.isFinite(e.location.lat) && Number.isFinite(e.location.lon))).toBe(true);
  });

  it("bands severity from the headline (no fatality data available)", () => {
    const ua = rows.find((e) => e.countryCode === "UA")!;
    const ru = rows.find((e) => e.countryCode === "RU")!;
    const jp = rows.find((e) => e.countryCode === "JP")!;
    expect(ua.severity).toBe("warning"); // "airstrike"
    expect(ru.severity).toBe("critical"); // "massacre"
    expect(jp.severity).toBe("watch"); // no intensity words
  });

  it("labels the source and carries provenance", () => {
    expect(rows[0].source).toBe("GDELT");
    expect(rows[0].provenance?.provider).toBe("gdelt-conflict");
    expect(rows[0].id).toMatch(/^event:gdelt-conflict:/);
  });

  it("parses an empty/absent article list to an empty array", () => {
    expect(normalizeGdeltConflict({})).toEqual([]);
  });
});
