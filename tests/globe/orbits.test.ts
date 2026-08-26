import { describe, expect, it } from "vitest";
import { loadSgp4 } from "@/lib/sgp4-client";
import { periodSeconds, sampleOrbitGeodetic } from "@/lib/globe/render/orbits";

// Classic well-formed ISS (ZARYA) TLE — propagation is deterministic regardless
// of the run date, so the structural assertions below are stable.
const TLE1 = "1 25544U 98067A   20264.51782528 -.00002182  00000-0 -11606-4 0  9990";
const TLE2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537";

describe("orbit sampling (SGP4)", () => {
  it("derives an ISS-like orbital period (~92 min)", async () => {
    const sat = await loadSgp4();
    const rec = sat.twoline2satrec(TLE1, TLE2);
    expect(rec.error).toBeFalsy();
    const p = periodSeconds(rec, null);
    expect(p).toBeGreaterThan(85 * 60);
    expect(p).toBeLessThan(95 * 60);
  });

  it("samples a full past+future arc in LEO around now", async () => {
    const sat = await loadSgp4();
    const rec = sat.twoline2satrec(TLE1, TLE2);
    const N = 32;
    const { past, future, ground } = sampleOrbitGeodetic(sat, rec, periodSeconds(rec, null), Date.now(), N);

    // Counts: past = [-N..0], future = [0..N], ground = full span.
    expect(past.length).toBe(N + 1);
    expect(future.length).toBe(N + 1);
    expect(ground.length).toBe(2 * N + 1);

    // The join point (i=0) is shared by both arcs.
    expect(future[0].lat).toBeCloseTo(past[past.length - 1].lat, 6);
    expect(future[0].lon).toBeCloseTo(past[past.length - 1].lon, 6);

    // Every sample sits at ISS altitude (~340–450 km).
    for (const g of ground) {
      expect(g.alt).toBeGreaterThan(300_000);
      expect(g.alt).toBeLessThan(500_000);
    }
  });
});
