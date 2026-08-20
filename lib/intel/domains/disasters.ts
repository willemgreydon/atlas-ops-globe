import { fetchEarthquakes } from "@/lib/providers/usgs";
import { fetchEonetEvents } from "@/lib/providers/eonet";
import { prov } from "@/lib/intel/provenance";
import { isValidPoint } from "@/lib/core/geo";
import { runIngestor, type IngestCounts, type IngestReport } from "../ingest";
import { upsertEvent } from "../repositories";
import { linkEventCountry } from "../enrich";
import { nearestCountry } from "../resolve";
import type { WorldEvent } from "@/types/domain";
import type { VaultEvent } from "../schemas";

/** USGS earthquakes + NASA EONET natural events → canonical disaster events. */
export async function ingestDisasters(): Promise<IngestReport> {
  return runIngestor({ domain: "disasters", source: "usgs+eonet", job: "disasters-sync" }, async (c) => {
    const [quakes, eonet] = await Promise.allSettled([fetchEarthquakes(), fetchEonetEvents()]);
    if (quakes.status === "fulfilled") storeEvents(quakes.value, "usgs", c);
    else c.failed++;
    if (eonet.status === "fulfilled") storeEvents(eonet.value, "eonet", c);
    else c.failed++;
  });
}

function storeEvents(events: WorldEvent[], provider: string, c: IngestCounts): void {
  for (const e of events) {
    c.fetched++;
    if (!isValidPoint(e.location)) { c.skipped++; continue; }
    let iso2 = e.countryCode;
    let basis: "reported" | "spatially-near" = "reported";
    if (!iso2) {
      const near = nearestCountry(e.location);
      if (near) { iso2 = near.iso2; basis = "spatially-near"; }
    }
    const record: VaultEvent = {
      id: e.id,
      kind: "disaster",
      subtype: e.tags?.[0],
      title: e.title,
      summary: e.summary,
      severity: e.severity,
      occurredAt: e.occurredAt,
      lat: e.location.lat,
      lon: e.location.lon,
      countryCode: iso2,
      source: e.source,
      sourceUrl: e.sourceUrl,
      confidence: e.confidence,
      tags: e.tags ?? [],
      provenance: [
        prov({
          provider,
          providerRecordId: e.id,
          sourceUrl: e.sourceUrl,
          observedAt: e.occurredAt,
          confidence: e.confidence,
        }),
      ],
    };
    upsertEvent(record);
    if (iso2) linkEventCountry(record.id, iso2, basis);
    c.created++;
  }
}
