import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCisaKev } from "@/lib/intel/providers/cisa-kev";
import { fetchCelestrak } from "@/lib/intel/providers/celestrak";
import { VaultSpaceObject, VaultVulnerability } from "@/lib/intel/schemas";

const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, "..", "fixtures", name), "utf8"));

/** Stub global fetch to return a fixture as JSON (no network). */
function stubFetch(payload: unknown) {
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("CISA KEV normalization", () => {
  it("maps catalogue entries to valid VaultVulnerability records", async () => {
    stubFetch(fixture("cisa-kev.sample.json"));
    const vulns = await fetchCisaKev();
    expect(vulns).toHaveLength(2);
    const first = vulns[0];
    expect(first.id).toBe("cve:CVE-2026-12345");
    expect(first.kev).toBe(true);
    expect(first.cwe).toContain("CWE-22");
    expect(first.provenance[0].provider).toBe("cisa-kev");
    // canonical schema holds
    expect(() => VaultVulnerability.parse(first)).not.toThrow();
  });
});

describe("CelesTrak normalization", () => {
  it("derives SGP4-ready orbit metadata from OMM elements", async () => {
    stubFetch(fixture("celestrak.sample.json"));
    const objects = await fetchCelestrak("stations");
    const iss = objects.find((o) => o.norad === "25544")!;
    expect(iss.id).toBe("satellite:norad-25544");
    expect(iss.inclinationDeg).toBeCloseTo(51.6332, 3);
    // period = 1440 / mean_motion; 1440/15.5 ~ 92.9 min (LEO)
    expect(iss.periodMin).toBeGreaterThan(90);
    expect(iss.periodMin).toBeLessThan(95);
    // ISS apogee/perigee are low-Earth-orbit altitudes
    expect(iss.apogeeKm!).toBeGreaterThan(350);
    expect(iss.apogeeKm!).toBeLessThan(500);
    expect(() => VaultSpaceObject.parse(iss)).not.toThrow();
  });

  it("accepts numeric or string NORAD ids", async () => {
    stubFetch(fixture("celestrak.sample.json"));
    const objects = await fetchCelestrak("stations");
    expect(objects.map((o) => o.norad)).toEqual(["25544", "60000"]);
  });
});
