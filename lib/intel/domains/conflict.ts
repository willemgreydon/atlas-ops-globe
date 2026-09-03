import { fetchAcledEvents, acledConfigured } from "../providers/acled";
import { fetchGdeltConflict } from "@/lib/providers/gdelt-conflict";
import { prov } from "@/lib/intel/provenance";
import { isValidPoint } from "@/lib/core/geo";
import { runIngestor, type IngestCounts, type IngestReport } from "../ingest";
import { upsertEvent } from "../repositories";
import { linkEventCountry } from "../enrich";
import { nearestCountry } from "../resolve";
import type { WorldEvent } from "@/types/domain";
import type { VaultEvent } from "../schemas";

/**
 * Conflict & unrest → canonical events (kind="conflict"), best-source-first:
 *  - GDELT DOC (keyless, media-derived) is the always-on baseline so the vault —
 *    and therefore the Observatory Risk index and the globe conflict layer — has
 *    political-conflict data with no credential. This MUST be synced into the
 *    vault here rather than fetched live-at-request: GDELT is unreachable from
 *    Vercel's serverless egress (like OpenSky), but reachable from the CI/GitHub
 *    runner that drives the sync.
 *  - ACLED (curated, fatality-verified) merges on top when ACLED_USERNAME/
 *    ACLED_PASSWORD are set.
 *
 * Neutral labelling throughout. Never throws for an empty/erroring source — a
 * transient upstream blip counts as failed/skipped but doesn't sink the sync.
 */
export async function ingestConflict(opts: { days?: number; limit?: number } = {}): Promise<IngestReport> {
  return runIngestor({ domain: "conflict", source: "gdelt+acled", job: "conflict-events" }, async (c) => {
    const [gdelt, acled] = await Promise.allSettled([
      fetchGdeltConflict(),
      acledConfigured()
        ? fetchAcledEvents({ days: opts.days ?? 14, limit: opts.limit ?? 800 })
        : Promise.resolve([]),
    ]);

    // GDELT returns WorldEvent[] (nested location) → map to canonical VaultEvent.
    if (gdelt.status === "fulfilled") storeWorldEvents(gdelt.value, "gdelt-conflict", c);
    else c.failed++;

    // ACLED already returns VaultEvent[] in canonical shape.
    if (acled.status === "fulfilled") {
      for (const e of acled.value) {
        c.fetched++;
        upsertEvent(e);
        if (e.countryCode) linkEventCountry(e.id, e.countryCode, "reported");
        c.created++;
      }
    } else if (acledConfigured()) {
      c.failed++;
    }
  });
}

/** GDELT conflict WorldEvent[] → canonical conflict VaultEvents (cf. disasters). */
function storeWorldEvents(events: WorldEvent[], provider: string, c: IngestCounts): void {
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
      kind: "conflict",
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
