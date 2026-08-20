import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeVessels } from "@/lib/intel/providers/marinetraffic";
import { VaultVessel } from "@/lib/intel/schemas";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "..", "fixtures", "marinetraffic.sample.json"), "utf8"),
);

describe("MarineTraffic normalization", () => {
  const vessels = normalizeVessels(fixture);

  it("normalizes AIS records to valid VaultVessel objects", () => {
    // Third record has neither IMO nor MMSI → dropped.
    expect(vessels).toHaveLength(2);
    for (const v of vessels) expect(() => VaultVessel.parse(v)).not.toThrow();
  });

  it("prefers IMO for identity, falls back to MMSI", () => {
    expect(vessels[0].id).toBe("vessel:imo-9811000");
    expect(vessels[1].id).toBe("vessel:mmsi-538005000"); // IMO "0" ignored
  });

  it("converts speed from knots×10 to knots", () => {
    expect(vessels[0].speedKn).toBeCloseTo(12.1, 5); // SPEED "121" -> 12.1 kn
    expect(vessels[1].speedKn).toBe(0);
  });

  it("carries MarineTraffic provenance and attribution", () => {
    expect(vessels[0].provenance[0].provider).toBe("marinetraffic");
    expect(vessels[0].provenance[0].attribution).toBe("MarineTraffic");
    expect(vessels[0].vesselType).toBe("Crude Oil Tanker");
    expect(vessels[0].flag).toBe("LR");
  });
});
