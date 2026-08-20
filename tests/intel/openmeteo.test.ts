import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentWeather } from "@/lib/intel/providers/openmeteo";
import { VaultWeatherObs } from "@/lib/intel/schemas";
import type { City } from "@/lib/intel/geo/cities";

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "..", "fixtures", "openmeteo.sample.json"), "utf8"),
);

function stubFetch(payload: unknown) {
  vi.stubGlobal("fetch", async () => ({
    ok: true, status: 200, statusText: "OK",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
}
afterEach(() => vi.unstubAllGlobals());

const CITIES: City[] = [
  { name: "Tokyo", iso2: "JP", point: { lat: 35.68, lon: 139.69 } },
  { name: "London", iso2: "GB", point: { lat: 51.51, lon: -0.13 } },
];

describe("Open-Meteo normalization", () => {
  it("expands a batch response into per-variable VaultWeatherObs", async () => {
    stubFetch(fixture);
    const obs = await fetchCurrentWeather(CITIES);
    // 2 cities × 6 requested variables (missing ones become null rows too)
    expect(obs.length).toBe(12);
    for (const o of obs) expect(() => VaultWeatherObs.parse(o)).not.toThrow();
  });

  it("maps city metadata and units correctly", async () => {
    stubFetch(fixture);
    const obs = await fetchCurrentWeather(CITIES);
    const tokyoTemp = obs.find((o) => o.place === "Tokyo" && o.variable === "temperature_2m")!;
    expect(tokyoTemp.value).toBe(24.6);
    expect(tokyoTemp.unit).toBe("°C");
    expect(tokyoTemp.countryCode).toBe("JP");
    expect(tokyoTemp.id).toBe("wx:35.68,139.69:temperature_2m");
    expect(tokyoTemp.provenance[0].provider).toBe("openmeteo");
  });

  it("returns empty for no cities", async () => {
    expect(await fetchCurrentWeather([])).toEqual([]);
  });
});
