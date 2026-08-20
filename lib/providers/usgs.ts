import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";
import { mockEvents } from "@/lib/mock";

/**
 * USGS Earthquakes — GeoJSON feed of M4.5+ events in the last 24h.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */
const Schema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({
        title: z.string(),
        time: z.number(),
        mag: z.number().nullable(),
        url: z.string().optional(),
      }),
      geometry: z.object({ coordinates: z.array(z.number()) }),
    }),
  ),
});

const RELIABILITY = 0.97; // authoritative primary source

function severityForMag(mag: number): Severity {
  if (mag >= 6) return "critical";
  if (mag >= 5) return "warning";
  return "watch";
}

export async function fetchEarthquakes(): Promise<WorldEvent[]> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
  const raw = await fetchJson<unknown>(url);
  const data = Schema.parse(raw);

  return data.features.flatMap((f) => {
    const [lon, lat, depthKm] = f.geometry.coordinates;
    const location = { lon, lat, alt: depthKm != null ? -depthKm * 1000 : undefined };
    if (!isValidPoint(location)) return [];
    const mag = f.properties.mag ?? 0;
    const observedAt = new Date(f.properties.time).toISOString();
    const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.9 }).score;

    return [
      {
        id: `event:usgs:${f.id}`,
        kind: "disaster",
        title: f.properties.title,
        severity: severityForMag(mag),
        occurredAt: observedAt,
        location,
        source: "USGS",
        sourceUrl: f.properties.url,
        confidence,
        tags: ["earthquake", `M${mag}`],
        provenance: makeProvenance({
          provider: "usgs",
          providerRecordId: f.id,
          sourceUrl: f.properties.url,
          observedAt,
          confidence,
          rawObjectHash: hashPayload(f),
        }),
      } satisfies WorldEvent,
    ];
  });
}

export const usgsProvider: ProviderDefinition<WorldEvent[]> = {
  key: "usgs",
  label: "USGS Earthquakes",
  ttlMs: 60_000,
  reliability: RELIABILITY,
  fetch: fetchEarthquakes,
  mock: () => mockEvents().filter((e) => e.tags?.includes("earthquake")),
};
