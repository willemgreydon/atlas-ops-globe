import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards the static data assets shipped from /public/data — the layers that add
 * dense coverage over Russia / China / Central Africa / Australia. If a rebuild
 * produces an empty, malformed, or thinned-out file, these fail loudly instead
 * of silently shipping an empty layer.
 */
function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), "public/data", name), "utf8"));
}

const inBox = (o: { lat: number; lon: number }, la1: number, la2: number, lo1: number, lo2: number) =>
  o.lat >= la1 && o.lat <= la2 && o.lon >= lo1 && o.lon <= lo2;

const finiteCoords = (rows: { lat: number; lon: number }[]) =>
  rows.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180);

describe("power plants asset (WRI)", () => {
  const rows = loadJson<{ id: string; name: string; lat: number; lon: number; fuel: string; mw: number }[]>("powerplants.json");
  it("is a large, well-formed set", () => {
    expect(rows.length).toBeGreaterThan(10_000);
    expect(finiteCoords(rows)).toBe(true);
    expect(rows.every((r) => r.id && r.name && r.fuel && r.mw >= 30)).toBe(true);
  });
  it("is dense over China, Russia and Australia", () => {
    expect(rows.filter((r) => inBox(r, 18, 54, 73, 135)).length).toBeGreaterThan(1_000); // China
    expect(rows.filter((r) => inBox(r, 41, 78, 30, 180)).length).toBeGreaterThan(300); // Russia
    expect(rows.filter((r) => inBox(r, -45, -10, 112, 154)).length).toBeGreaterThan(100); // Australia
  });
});

describe("ports asset (NGA WPI)", () => {
  const rows = loadJson<{ id: string; name: string; lat: number; lon: number }[]>("ports.json");
  it("is a well-formed global set", () => {
    expect(rows.length).toBeGreaterThan(3_000);
    expect(finiteCoords(rows)).toBe(true);
    expect(rows.every((r) => r.name)).toBe(true);
  });
});

describe("cities asset (GeoNames)", () => {
  const rows = loadJson<{ id: string; name: string; lat: number; lon: number; pop: number }[]>("cities.json");
  it("is a large, well-formed set covering every populated region", () => {
    expect(rows.length).toBeGreaterThan(20_000);
    expect(finiteCoords(rows)).toBe(true);
    expect(rows.every((r) => r.id && r.name)).toBe(true);
  });
  it("is dense over China, Russia, Central Africa and Australia", () => {
    expect(rows.filter((r) => inBox(r, 18, 54, 73, 135)).length).toBeGreaterThan(2_000); // China
    expect(rows.filter((r) => inBox(r, 41, 78, 30, 180)).length).toBeGreaterThan(800); // Russia
    expect(rows.filter((r) => inBox(r, -15, 15, 10, 40)).length).toBeGreaterThan(400); // Central Africa
    expect(rows.filter((r) => inBox(r, -45, -10, 112, 154)).length).toBeGreaterThan(100); // Australia
  });
  it("includes Moscow", () => {
    const moscow = rows.find((r) => r.name === "Moscow" && inBox(r, 55, 56, 37, 38));
    expect(moscow).toBeTruthy();
    expect(moscow!.pop).toBeGreaterThan(1_000_000);
  });
});

describe("volcanoes asset (Smithsonian GVP)", () => {
  const rows = loadJson<{ id: string; name: string; lat: number; lon: number }[]>("volcanoes.json");
  it("is the full Holocene list", () => {
    expect(rows.length).toBeGreaterThan(1_000);
    expect(finiteCoords(rows)).toBe(true);
  });
  it("covers Kamchatka and the East African Rift", () => {
    expect(rows.filter((r) => inBox(r, 50, 60, 155, 165)).length).toBeGreaterThan(10); // Kamchatka
    expect(rows.filter((r) => inBox(r, -12, 5, 25, 40)).length).toBeGreaterThan(10); // EAR / DRC
  });
});
