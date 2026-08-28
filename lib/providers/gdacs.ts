import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";
import { mockEvents } from "@/lib/mock";

/**
 * GDACS — Global Disaster Alert and Coordination System (UN/EC), keyless.
 * https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP
 *
 * Fills the gap left by USGS (quakes only) and EONET (fires/storms/volcanoes):
 * GDACS uniquely reports FLOODS, DROUGHTS and TROPICAL CYCLONES worldwide — the
 * events that dominate Asia and Africa (floods in Nepal/China/India, cyclones in
 * the Indian Ocean), which is where the globe looked empty. We drop GDACS
 * earthquakes to avoid double-plotting the authoritative USGS quakes.
 */
const Schema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.array(z.number()) }).nullable().optional(),
      properties: z.object({
        eventtype: z.string(),
        eventid: z.union([z.string(), z.number()]).optional(),
        alertlevel: z.string().optional(),
        name: z.string().optional(),
        htmldescription: z.string().optional(),
        fromdate: z.string().optional(),
        country: z.string().optional(),
        severitydata: z.object({ severitytext: z.string().optional() }).nullable().optional(),
        url: z.object({ report: z.string().optional() }).nullable().optional(),
      }),
    }),
  ),
});

const RELIABILITY = 0.9;

// GDACS event type → readable label for the tag/tooltip.
const TYPE_LABEL: Record<string, string> = {
  TC: "cyclone", FL: "flood", DR: "drought", VO: "volcano", WF: "wildfire", TS: "tsunami",
};

function severityForAlert(level?: string): Severity {
  switch ((level ?? "").toLowerCase()) {
    case "red": return "critical";
    case "orange": return "warning";
    default: return "watch";
  }
}

export async function fetchGdacsDisasters(): Promise<WorldEvent[]> {
  const raw = await fetchJson<unknown>("https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP", {
    timeoutMs: 12_000,
  });
  const data = Schema.parse(raw);

  return data.features.flatMap((f) => {
    const p = f.properties;
    // Skip earthquakes — USGS is the authoritative source and already plotted.
    if (p.eventtype === "EQ") return [];
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];
    const [lon, lat] = coords;
    const location = { lon, lat };
    if (!isValidPoint(location)) return [];

    const label = TYPE_LABEL[p.eventtype] ?? p.eventtype.toLowerCase();
    const eventId = String(p.eventid ?? hashPayload(f));
    const occurredAt = p.fromdate ? new Date(p.fromdate).toISOString() : new Date().toISOString();
    const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.8 }).score;

    return [
      {
        id: `event:gdacs:${p.eventtype}:${eventId}`,
        kind: "disaster",
        title: p.name ?? p.htmldescription ?? `${label} (${p.country ?? "global"})`,
        summary: p.severitydata?.severitytext ?? undefined,
        severity: severityForAlert(p.alertlevel),
        occurredAt,
        location,
        countryCode: undefined,
        source: "GDACS",
        sourceUrl: p.url?.report,
        confidence,
        tags: [label, "gdacs"],
        provenance: makeProvenance({
          provider: "gdacs",
          providerRecordId: eventId,
          sourceUrl: p.url?.report ?? "https://www.gdacs.org/",
          observedAt: occurredAt,
          confidence,
          rawObjectHash: hashPayload(f),
        }),
      } satisfies WorldEvent,
    ];
  });
}

export const gdacsProvider: ProviderDefinition<WorldEvent[]> = {
  key: "gdacs",
  label: "GDACS (floods · cyclones · droughts)",
  ttlMs: 5 * 60_000,
  reliability: RELIABILITY,
  fetch: fetchGdacsDisasters,
  mock: () => mockEvents().filter((e) => !e.tags?.includes("earthquake")),
};
