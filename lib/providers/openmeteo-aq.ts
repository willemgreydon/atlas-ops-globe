import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { WORLD_CITIES } from "@/lib/intel/geo/gazetteer";
import type { AirQualityRow } from "@/stores/app-store";

/**
 * Open-Meteo Air Quality — keyless, global, reachable from Vercel. Sampled at the
 * world-city gazetteer, which is weighted toward Asia/Russia/Africa, so the layer
 * is densest over exactly the cities where air quality is a live story (Beijing,
 * Delhi, Lahore, Cairo…). US AQI + PM2.5, current conditions. Live-at-request.
 */
const CitySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: z.object({ us_aqi: z.number().nullable().optional(), pm2_5: z.number().nullable().optional(), time: z.string().optional() }).optional(),
});
const Schema = z.union([CitySchema, z.array(CitySchema)]);

export async function fetchAirQuality(cities = WORLD_CITIES): Promise<AirQualityRow[]> {
  const lats = cities.map((c) => c.lat).join(",");
  const lons = cities.map((c) => c.lon).join(",");
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm2_5`;
  const raw = await fetchJson<unknown>(url, { timeoutMs: 12_000 });
  const parsed = Schema.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  const out: AirQualityRow[] = [];
  arr.forEach((r, i) => {
    const city = cities[i];
    const aqi = r.current?.us_aqi ?? null;
    if (!city || aqi == null) return;
    out.push({
      id: `aq:${city.iso2}:${city.name}`,
      place: city.name,
      country: city.iso2,
      lat: city.lat,
      lon: city.lon,
      aqi,
      pm25: r.current?.pm2_5 ?? null,
      observedAt: r.current?.time ? `${r.current.time}Z` : new Date().toISOString(),
    });
  });
  return out;
}
