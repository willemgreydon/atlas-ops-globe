import { fetchCelestrak } from "../providers/celestrak";
import { log } from "@/lib/core/logger";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertSpaceObject } from "../repositories";

/**
 * CelesTrak satellite catalogue (OMM elements, SGP4-ready) → space_objects.
 * Stores orbital metadata, not propagated positions. `limit` caps how many are
 * stored per run; any truncation is logged (never silent).
 */
export async function ingestSpace(group = "active", limit = 2000): Promise<IngestReport> {
  return runIngestor({ domain: "space", source: "celestrak", job: `catalog-${group}` }, async (c) => {
    const objects = await fetchCelestrak(group);
    const capped = objects.slice(0, limit);
    if (objects.length > capped.length) {
      log.warn("celestrak result capped", { provider: "celestrak", records: objects.length, kept: capped.length });
    }
    for (const o of capped) { c.fetched++; upsertSpaceObject(o); c.created++; }
    c.skipped += objects.length - capped.length;
  });
}
