import { NextResponse } from "next/server";
import { fetchAirQuality } from "@/lib/providers/openmeteo-aq";
import { attachFreshness } from "@/lib/intel/freshness";
import { cachedFetch } from "@/lib/intel/live";
import { scrubError } from "@/lib/intel/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Air quality (Open-Meteo US AQI) sampled at the world-city gazetteer — live from
 * Vercel, keyless, densest over Asia/Russia/Africa cities. Freshness reuses the
 * weather thresholds (current conditions update ~hourly).
 */
const TTL_MS = 10 * 60_000;

export async function GET() {
  try {
    const data = (await cachedFetch("airquality", TTL_MS, () => fetchAirQuality())) as unknown as Record<string, unknown>[];
    const result = { data, page: { limit: data.length, offset: 0, count: data.length, nextOffset: null } };
    return NextResponse.json({ ...attachFreshness(result, "weather", "observedAt"), provider: "openmeteo", attribution: "Open-Meteo Air Quality (CC BY 4.0)" });
  } catch (e) {
    const result = { data: [], page: { limit: 0, offset: 0, count: 0, nextOffset: null } };
    return NextResponse.json({ ...attachFreshness(result, "weather", "observedAt"), provider: "openmeteo", attribution: "Open-Meteo Air Quality (CC BY 4.0)", error: scrubError(e, "airquality") });
  }
}
