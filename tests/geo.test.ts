import { describe, expect, it } from "vitest";
import { fromPosition, haversineKm, inBounds, isValidPoint, toPosition } from "@/lib/core/geo";

describe("geo", () => {
  it("round-trips GeoPoint <-> GeoJSON [lon,lat] position", () => {
    const p = { lat: 48.2, lon: 16.37, alt: 200 };
    expect(toPosition(p)).toEqual([16.37, 48.2, 200]);
    expect(fromPosition([16.37, 48.2, 200])).toEqual(p);
  });

  it("emits [lon, lat] with longitude first", () => {
    const [lon, lat] = toPosition({ lat: 10, lon: 20 });
    expect(lon).toBe(20);
    expect(lat).toBe(10);
  });

  it("validates coordinates", () => {
    expect(isValidPoint({ lat: 45, lon: 90 })).toBe(true);
    expect(isValidPoint({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidPoint({ lat: 0, lon: 181 })).toBe(false);
    expect(isValidPoint(undefined)).toBe(false);
  });

  it("computes great-circle distance", () => {
    // London -> Paris ~ 344 km
    const d = haversineKm({ lat: 51.5, lon: -0.13 }, { lat: 48.85, lon: 2.35 });
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(360);
  });

  it("handles antimeridian-crossing bounds", () => {
    const bounds = { west: 170, south: -10, east: -170, north: 10 };
    expect(inBounds({ lat: 0, lon: 179 }, bounds)).toBe(true);
    expect(inBounds({ lat: 0, lon: -179 }, bounds)).toBe(true);
    expect(inBounds({ lat: 0, lon: 0 }, bounds)).toBe(false);
  });
});
