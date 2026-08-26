import { describe, expect, it } from "vitest";
import { magnitudeOf, peakRadius } from "@/lib/globe/render/effects";
import type { WorldEvent } from "@/types/domain";

function quake(title: string, severity: WorldEvent["severity"] = "warning"): WorldEvent {
  return {
    id: "e1",
    kind: "disaster",
    title,
    severity,
    occurredAt: new Date().toISOString(),
    location: { lat: 0, lon: 0 },
    source: "USGS",
    tags: ["earthquake"],
  };
}

describe("effects: magnitude parsing", () => {
  it("parses a magnitude from a USGS-style headline", () => {
    expect(magnitudeOf(quake("M 6.1 - 20km SW of Town"))).toBe(6.1);
    expect(magnitudeOf(quake("M4 - offshore"))).toBe(4);
  });

  it("returns null for a non-quake event", () => {
    const news: WorldEvent = { ...quake("no magnitude here"), kind: "conflict", tags: [] };
    expect(magnitudeOf(news)).toBeNull();
  });
});

describe("effects: ripple radius", () => {
  it("scales with magnitude — a bigger quake ripples wider", () => {
    const small = peakRadius(quake("M 4.0 - a"));
    const big = peakRadius(quake("M 7.0 - b"));
    expect(big).toBeGreaterThan(small);
  });

  it("clamps radius into a sane range", () => {
    const tiny = peakRadius(quake("M 1.0 - a"));
    const huge = peakRadius(quake("M 9.9 - b"));
    expect(tiny).toBeGreaterThanOrEqual(60_000);
    expect(huge).toBeLessThanOrEqual(900_000);
  });

  it("falls back to severity when no magnitude is present", () => {
    const critical: WorldEvent = { ...quake("power grid failure", "critical"), kind: "conflict", tags: [] };
    const watch: WorldEvent = { ...quake("minor unrest", "watch"), kind: "conflict", tags: [] };
    expect(peakRadius(critical)).toBeGreaterThan(peakRadius(watch));
  });
});
