import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { prov } from "@/lib/intel/provenance";
import { isValidPoint } from "@/lib/core/geo";
import type { City } from "@/lib/intel/geo/cities";
import type { VaultWeatherObs } from "@/lib/intel/schemas";

/**
 * Open-Meteo Forecast API — current weather, no API key required (CC BY 4.0).
 * https://open-meteo.com/en/docs
 *
 * Multiple coordinates can be requested in one call (comma-separated lat/lon),
 * returning an array of per-location blocks — efficient batch retrieval.
 */
const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "pressure_msl",
  "weather_code",
] as const;

const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  current_units: z.record(z.string(), z.string()).optional(),
});
// One coord → object; many coords → array. Normalize to array.
const ResponseSchema = z.union([LocationSchema, z.array(LocationSchema)]);

function toObs(loc: z.infer<typeof LocationSchema>, city: City | undefined): VaultWeatherObs[] {
  const cur = loc.current;
  if (!cur) return [];
  const observedAt = typeof cur.time === "string" ? cur.time : new Date().toISOString();
  const units = loc.current_units ?? {};
  const lat = city?.point.lat ?? loc.latitude;
  const lon = city?.point.lon ?? loc.longitude;
  if (!isValidPoint({ lat, lon })) return [];

  return CURRENT_VARS.flatMap((variable) => {
    const raw = cur[variable];
    const value = typeof raw === "number" ? raw : raw != null ? Number(raw) : null;
    return [
      {
        id: `wx:${lat.toFixed(2)},${lon.toFixed(2)}:${variable}`,
        lat,
        lon,
        place: city?.name,
        countryCode: city?.iso2,
        observedAt,
        variable,
        value: Number.isFinite(value as number) ? (value as number) : null,
        unit: units[variable],
        provider: "openmeteo",
        provenance: [
          prov({
            provider: "openmeteo",
            dataset: "forecast/current",
            observedAt,
            license: "CC BY 4.0",
            attribution: "Open-Meteo",
          }),
        ],
      } satisfies VaultWeatherObs,
    ];
  });
}

/** Fetch current weather for a batch of cities in a single request. */
export async function fetchCurrentWeather(cities: City[]): Promise<VaultWeatherObs[]> {
  if (cities.length === 0) return [];
  const qs = new URLSearchParams({
    latitude: cities.map((c) => c.point.lat).join(","),
    longitude: cities.map((c) => c.point.lon).join(","),
    current: CURRENT_VARS.join(","),
    timezone: "UTC",
  });
  const raw = await fetchJson<unknown>(`https://api.open-meteo.com/v1/forecast?${qs}`, { timeoutMs: 20_000 });
  const parsed = ResponseSchema.parse(raw);
  const locations = Array.isArray(parsed) ? parsed : [parsed];
  return locations.flatMap((loc, i) => toObs(loc, cities[i]));
}
