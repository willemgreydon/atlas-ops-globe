import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { WorldEvent } from "@/types/domain";
import { mockEvents } from "@/lib/mock";

/**
 * NASA EONET — Earth Observatory Natural Event Tracker (open events).
 * https://eonet.gsfc.nasa.gov/docs/v3
 */
const Schema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      categories: z.array(z.object({ title: z.string() })).optional(),
      geometry: z
        .array(z.object({ date: z.string(), coordinates: z.array(z.number()) }))
        .optional(),
      sources: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
    }),
  ),
});

const RELIABILITY = 0.9;

export async function fetchEonetEvents(): Promise<WorldEvent[]> {
  const raw = await fetchJson<unknown>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100");
  const data = Schema.parse(raw);

  return data.events.flatMap((e) => {
    const g = e.geometry?.at(-1);
    if (!g || g.coordinates.length < 2) return [];
    const location = { lon: g.coordinates[0], lat: g.coordinates[1] };
    if (!isValidPoint(location)) return [];
    const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.7 }).score;

    return [
      {
        id: `event:eonet:${e.id}`,
        kind: "disaster",
        title: e.title,
        severity: "watch",
        occurredAt: g.date,
        location,
        source: e.sources?.[0]?.id || "NASA EONET",
        sourceUrl: e.sources?.[0]?.url,
        confidence,
        tags: e.categories?.map((c) => c.title),
        provenance: makeProvenance({
          provider: "eonet",
          providerRecordId: e.id,
          sourceUrl: e.sources?.[0]?.url,
          observedAt: g.date,
          confidence,
          rawObjectHash: hashPayload(e),
        }),
      } satisfies WorldEvent,
    ];
  });
}

export const eonetProvider: ProviderDefinition<WorldEvent[]> = {
  key: "eonet",
  label: "NASA EONET Natural Events",
  ttlMs: 300_000,
  reliability: RELIABILITY,
  fetch: fetchEonetEvents,
  mock: () => mockEvents().filter((e) => e.tags?.includes("wildfire")),
};
