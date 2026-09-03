import { describe, expect, it } from "vitest";
import { parseGdeltEvents } from "@/lib/providers/gdelt-events";

/** Build a valid 61-field GDELT 2.0 Event row; override any column by index. */
function row(overrides: Record<number, string> = {}): string {
  const f = new Array(61).fill("");
  f[0] = "123";                                   // GLOBALEVENTID
  f[28] = "19";                                   // EventRootCode (Fight)
  f[29] = "4";                                    // QuadClass (material conflict)
  f[30] = "-5";                                   // GoldsteinScale
  f[33] = "3";                                    // NumArticles
  f[52] = "Manchester, Manchester, United Kingdom"; // ActionGeo_Fullname
  f[56] = "53.5";                                 // ActionGeo_Lat
  f[57] = "-2.2";                                 // ActionGeo_Long
  f[59] = "20260903123000";                       // DATEADDED
  f[60] = "https://ex.test/a";                    // SOURCEURL
  for (const [k, v] of Object.entries(overrides)) f[+k] = v;
  return f.join("\t");
}

describe("parseGdeltEvents — GDELT 2.0 Event → conflict WorldEvent", () => {
  it("keeps material-conflict events and maps id/geo/severity/date", () => {
    const rows = parseGdeltEvents(row());
    expect(rows).toHaveLength(1);
    const e = rows[0];
    expect(e.kind).toBe("conflict");
    expect(e.id).toBe("event:gdelt-ev:123");
    expect(e.location).toEqual({ lat: 53.5, lon: -2.2 });
    expect(e.severity).toBe("warning"); // root 19, quad 4, 3 reports (< 50)
    expect(e.title).toContain("Armed clash");
    expect(e.occurredAt).toBe("2026-09-03T12:30:00Z");
    expect(e.provenance?.provider).toBe("gdelt-events");
  });

  it("resolves the country from GDELT's own ActionGeo name (not nearest centroid)", () => {
    expect(parseGdeltEvents(row())[0].countryCode).toBe("GB"); // "…, United Kingdom"
    // A Miami event must resolve to the US via its name, not snap to the Bahamas.
    expect(parseGdeltEvents(row({ 52: "Miami, Florida, United States", 56: "25.77", 57: "-80.19" }))[0].countryCode).toBe("US");
  });

  it("drops the cooperation quadrants (1, 2)", () => {
    expect(parseGdeltEvents(row({ 29: "1" }))).toHaveLength(0);
    expect(parseGdeltEvents(row({ 29: "2" }))).toHaveLength(0);
  });

  it("keeps verbal conflict (QuadClass 3) as a watch", () => {
    expect(parseGdeltEvents(row({ 29: "3", 28: "17" }))[0].severity).toBe("watch");
  });

  it("escalates mass violence (root 20) to critical", () => {
    expect(parseGdeltEvents(row({ 28: "20" }))[0].severity).toBe("critical");
  });

  it("escalates a heavily-reported assault (root ≥ 18, ≥ 50 reports) to critical", () => {
    expect(parseGdeltEvents(row({ 28: "18", 33: "60" }))[0].severity).toBe("critical");
  });

  it("keeps a lightly-reported assault at warning, not critical", () => {
    expect(parseGdeltEvents(row({ 28: "18", 33: "40" }))[0].severity).toBe("warning");
  });

  it("caps material-conflict coercion (root 17) at warning even when heavily reported", () => {
    expect(parseGdeltEvents(row({ 28: "17", 33: "200" }))[0].severity).toBe("warning");
  });

  it("drops rows without a valid point", () => {
    expect(parseGdeltEvents(row({ 56: "", 57: "" }))).toHaveLength(0);
  });

  it("ignores short/garbage lines", () => {
    expect(parseGdeltEvents("a\tb\tc")).toEqual([]);
    expect(parseGdeltEvents("")).toEqual([]);
  });
});
