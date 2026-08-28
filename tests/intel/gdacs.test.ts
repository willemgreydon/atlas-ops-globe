import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJson = vi.fn();
vi.mock("@/lib/fetch-json", () => ({
  fetchJson: (...a: unknown[]) => fetchJson(...a),
  hashPayload: () => "hash",
}));

import { fetchGdacsDisasters } from "@/lib/providers/gdacs";

const feature = (over: Record<string, unknown>, coords = [100, 20]) => ({
  geometry: { coordinates: coords },
  properties: { eventtype: "FL", eventid: 1, alertlevel: "Orange", name: "Flood", fromdate: "2026-08-27T00:00:00", ...over },
});

describe("fetchGdacsDisasters", () => {
  beforeEach(() => fetchJson.mockReset());

  it("maps floods/cyclones with severity, tags and a precise point; skips earthquakes", async () => {
    fetchJson.mockResolvedValueOnce({
      features: [
        feature({ eventtype: "FL", alertlevel: "Red", name: "Flood in China", eventid: 7 }),
        feature({ eventtype: "TC", alertlevel: "Green", name: "Cyclone X", eventid: 8 }),
        feature({ eventtype: "EQ", alertlevel: "Orange", name: "Quake", eventid: 9 }), // dropped
      ],
    });
    const out = await fetchGdacsDisasters();
    expect(out).toHaveLength(2);
    const flood = out.find((e) => e.id.includes(":FL:"))!;
    expect(flood.severity).toBe("critical"); // Red
    expect(flood.tags).toContain("flood");
    expect(flood.source).toBe("GDACS");
    expect(flood.location).toEqual({ lon: 100, lat: 20 });
    expect(out.find((e) => e.id.includes(":EQ:"))).toBeUndefined();
    expect(out.find((e) => e.id.includes(":TC:"))!.severity).toBe("watch"); // Green
  });

  it("drops features without valid coordinates", async () => {
    fetchJson.mockResolvedValueOnce({
      features: [feature({ eventid: 1 }, []), feature({ eventid: 2 }, [200, 99])],
    });
    expect(await fetchGdacsDisasters()).toHaveLength(0);
  });
});
