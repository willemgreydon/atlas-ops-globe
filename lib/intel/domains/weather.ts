import { fetchCurrentWeather } from "../providers/openmeteo";
import { MAJOR_CITIES } from "../geo/cities";
import { mapPool, limiter } from "../pool";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertWeatherObs } from "../repositories";

/**
 * Current weather for a curated set of major cities via Open-Meteo (free, no
 * key). Stores point observations per variable — an honest station-style view,
 * not a full raster field (raster overlays are future work). Cities are fetched
 * in batches (Open-Meteo accepts many coordinates per request).
 */
const BATCH = 20;

export async function ingestWeather(): Promise<IngestReport> {
  return runIngestor({ domain: "weather", source: "openmeteo", job: "current-weather" }, async (c) => {
    const batches: (typeof MAJOR_CITIES)[] = [];
    for (let i = 0; i < MAJOR_CITIES.length; i += BATCH) batches.push(MAJOR_CITIES.slice(i, i + BATCH));

    await mapPool(batches, 2, async (cities) => {
      await limiter.wait("openmeteo", 300);
      try {
        const obs = await fetchCurrentWeather(cities);
        for (const o of obs) {
          c.fetched++;
          upsertWeatherObs(o);
          c.created++;
        }
      } catch {
        c.failed++;
      }
    });
  });
}
