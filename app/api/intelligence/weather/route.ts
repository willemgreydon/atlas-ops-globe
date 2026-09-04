import { NextRequest, NextResponse } from "next/server";
import { fetchCurrentWeather } from "@/lib/intel/providers/openmeteo";
import { MAJOR_CITIES } from "@/lib/intel/geo/cities";
import { attachFreshness } from "@/lib/intel/freshness";
import { parseBbox, parsePage } from "@/lib/intel/queries";
import { cachedFetch } from "@/lib/intel/live";
import { scrubError } from "@/lib/intel/safe-route";
import type { VaultWeatherObs } from "@/lib/intel/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weather is fetched live-at-request from Open-Meteo (free, no key, reachable
 * from Vercel) rather than served from the vault — the same reasoning as markets:
 * live-fetch is always fresh, needs no sync and no embedded-replica pull. One
 * observation set per city; the default `temperature_2m` gives one marker/city.
 */
const TTL_MS = 5 * 60_000; // current conditions update ~hourly; 5 min is plenty
const OBSERVED_AT = "observedAt";

function toRow(o: VaultWeatherObs): Record<string, unknown> {
  return {
    id: o.id,
    lat: o.lat,
    lon: o.lon,
    place: o.place,
    countryCode: o.countryCode,
    observedAt: o.observedAt,
    variable: o.variable,
    value: o.value,
    unit: o.unit,
    provider: o.provider,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const variable = sp.get("variable") ?? "temperature_2m";
  const bbox = parseBbox(sp.get("bbox"));
  const { limit } = parsePage(sp);
  try {
    const obs = await cachedFetch("weather", TTL_MS, () => fetchCurrentWeather(MAJOR_CITIES));
    const data = obs
      .filter((o) => o.variable === variable)
      .filter((o) => !bbox || (o.lon >= bbox[0] && o.lon <= bbox[2] && o.lat >= bbox[1] && o.lat <= bbox[3]))
      .sort((a, b) => (a.place ?? "").localeCompare(b.place ?? ""))
      .slice(0, limit)
      .map(toRow);
    const result = { data, page: { limit: data.length, offset: 0, count: data.length, nextOffset: null } };
    return NextResponse.json({ ...attachFreshness(result, "weather", OBSERVED_AT), provider: "openmeteo", attribution: "Open-Meteo (CC BY 4.0)" });
  } catch (e) {
    const result = { data: [], page: { limit: 0, offset: 0, count: 0, nextOffset: null } };
    return NextResponse.json({
      ...attachFreshness(result, "weather", OBSERVED_AT),
      provider: "openmeteo",
      attribution: "Open-Meteo (CC BY 4.0)",
      error: scrubError(e, "weather"),
    });
  }
}
