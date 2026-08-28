import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";
import { mockEvents } from "@/lib/mock";

/**
 * EMSC (European-Mediterranean Seismological Centre) — real-time earthquakes.
 * https://www.seismicportal.eu/fdsn-wsevent.html  (FDSN event web service)
 *
 * Complements USGS: USGS's M4.5+ daily feed is sparse over Eurasia, while EMSC
 * reports the many smaller regional quakes across the Mediterranean, Turkey,
 * the Caucasus, Iran and Central Asia — filling the seismic gap there. Keyless.
 * Route-level dedup drops the M4.5+ events both catalogs report (see /api/events).
 */
const Schema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.array(z.number()) }).nullable().optional(),
      properties: z.object({
        unid: z.string().optional(),
        source_id: z.union([z.string(), z.number()]).optional(),
        time: z.string(),
        mag: z.number().nullable().optional(),
        flynn_region: z.string().optional(),
        depth: z.number().nullable().optional(),
      }),
    }),
  ),
});

const RELIABILITY = 0.92;
const MIN_MAG = 2.5;
const LIMIT = 800;

function severityForMag(mag: number): Severity {
  if (mag >= 6) return "critical";
  if (mag >= 5) return "warning";
  return "watch";
}

export async function fetchEmscQuakes(): Promise<WorldEvent[]> {
  const start = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=${MIN_MAG}&limit=${LIMIT}&start=${start}`;
  const raw = await fetchJson<unknown>(url, { timeoutMs: 12_000 });
  const data = Schema.parse(raw);

  return data.features.flatMap((f) => {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];
    const [lon, lat, depth] = coords;
    const location = { lon, lat, alt: depth != null ? -depth * 1000 : undefined };
    if (!isValidPoint(location)) return [];
    const mag = p.mag ?? 0;
    const id = p.unid ?? String(p.source_id ?? hashPayload(f));
    const observedAt = new Date(p.time).toISOString();
    const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.9 }).score;

    return [
      {
        id: `event:emsc:${id}`,
        kind: "disaster",
        title: `M${mag.toFixed(1)} · ${p.flynn_region ?? "earthquake"}`,
        severity: severityForMag(mag),
        occurredAt: observedAt,
        location,
        source: "EMSC",
        sourceUrl: "https://www.seismicportal.eu/",
        confidence,
        tags: ["earthquake", `M${mag}`, "emsc"],
        provenance: makeProvenance({
          provider: "emsc",
          providerRecordId: id,
          sourceUrl: "https://www.seismicportal.eu/",
          observedAt,
          confidence,
          rawObjectHash: hashPayload(f),
        }),
      } satisfies WorldEvent,
    ];
  });
}

export const emscProvider: ProviderDefinition<WorldEvent[]> = {
  key: "emsc",
  label: "EMSC Earthquakes",
  ttlMs: 60_000,
  reliability: RELIABILITY,
  fetch: fetchEmscQuakes,
  mock: () => mockEvents().filter((e) => e.tags?.includes("earthquake")),
};
