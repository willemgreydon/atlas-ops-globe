import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared fetch helper so we can feed canned tile responses.
const fetchJson = vi.fn();
vi.mock("@/lib/fetch-json", () => ({ fetchJson: (...a: unknown[]) => fetchJson(...a) }));

import { fetchAdsbLolStates } from "@/lib/providers/adsblol";

describe("fetchAdsbLolStates", () => {
  beforeEach(() => fetchJson.mockReset());

  it("maps units (knots→m/s, feet→m), flags ground, and drops invalid rows", async () => {
    fetchJson.mockResolvedValueOnce({
      now: 1_000_000,
      ac: [
        { hex: "abc123", flight: "ABC1 ", lat: 10, lon: 20, alt_baro: 36000, gs: 480, track: 90, seen_pos: 2 },
        { hex: "def456", lat: 1, lon: 2, alt_baro: "ground", gs: 0 },
        { hex: "nopos", flight: "X" }, // no lat/lon → dropped
      ],
    });
    const out = await fetchAdsbLolStates([[0, 0]]);
    expect(out).toHaveLength(2);
    const a = out.find((x) => x.id === "aircraft:abc123")!;
    expect(a.callsign).toBe("ABC1");
    expect(a.velocityMs).toBeCloseTo(480 * 0.514444, 3);
    expect(a.position.alt).toBeCloseTo(36000 * 0.3048, 2);
    expect(a.headingDeg).toBe(90);
    expect(a.lastContact).toBe(new Date(1_000_000 - 2000).toISOString());
    const g = out.find((x) => x.id === "aircraft:def456")!;
    expect(g.onGround).toBe(true);
    expect(g.position.alt).toBeUndefined();
  });

  it("de-duplicates across overlapping tiles, keeping the freshest sighting", async () => {
    fetchJson
      .mockResolvedValueOnce({ now: 1_000_000, ac: [{ hex: "aa", lat: 5, lon: 5, seen_pos: 30 }] })
      .mockResolvedValueOnce({ now: 1_000_000, ac: [{ hex: "aa", lat: 5.1, lon: 5.1, seen_pos: 2 }] });
    const out = await fetchAdsbLolStates([[0, 0], [1, 1]]);
    expect(out).toHaveLength(1);
    expect(out[0].position.lat).toBe(5.1); // the fresher (seen_pos=2) sighting wins
  });

  it("tolerates partial tile failure but throws only if every tile fails", async () => {
    fetchJson
      .mockRejectedValueOnce(new Error("tile down"))
      .mockResolvedValueOnce({ now: 1_000_000, ac: [{ hex: "bb", lat: 9, lon: 9, seen_pos: 1 }] });
    const out = await fetchAdsbLolStates([[0, 0], [1, 1]]);
    expect(out).toHaveLength(1);

    fetchJson.mockReset();
    fetchJson
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"));
    await expect(fetchAdsbLolStates([[0, 0], [1, 1]])).rejects.toThrow(/all adsb\.lol tiles failed/);
  });
});
