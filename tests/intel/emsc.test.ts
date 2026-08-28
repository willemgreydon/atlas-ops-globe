import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJson = vi.fn();
vi.mock("@/lib/fetch-json", () => ({ fetchJson: (...a: unknown[]) => fetchJson(...a), hashPayload: () => "h" }));

import { fetchEmscQuakes } from "@/lib/providers/emsc";

describe("fetchEmscQuakes", () => {
  beforeEach(() => fetchJson.mockReset());

  it("maps FDSN features to earthquake events with depth and severity", async () => {
    fetchJson.mockResolvedValueOnce({
      features: [
        { geometry: { coordinates: [39.7, 47.2, 10] }, properties: { unid: "x1", time: "2026-08-28T05:00:00Z", mag: 5.2, flynn_region: "SOUTHERN RUSSIA", depth: 10 } },
        { geometry: { coordinates: [12.5, 41.9, 5] }, properties: { unid: "x2", time: "2026-08-28T06:00:00Z", mag: 3.1, flynn_region: "CENTRAL ITALY", depth: 5 } },
      ],
    });
    const out = await fetchEmscQuakes();
    expect(out).toHaveLength(2);
    const ru = out.find((e) => e.id === "event:emsc:x1")!;
    expect(ru.tags).toContain("earthquake");
    expect(ru.severity).toBe("warning"); // M5.2
    expect(ru.location.alt).toBe(-10000); // depth 10 km → -10000 m
    expect(out.find((e) => e.id === "event:emsc:x2")!.severity).toBe("watch"); // M3.1
  });

  it("drops features without valid coordinates", async () => {
    fetchJson.mockResolvedValueOnce({
      features: [{ geometry: { coordinates: [] }, properties: { unid: "y", time: "2026-08-28T00:00:00Z", mag: 4 } }],
    });
    expect(await fetchEmscQuakes()).toHaveLength(0);
  });
});
