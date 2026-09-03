import { fetchAcledEvents, acledConfigured } from "../providers/acled";
import { fetchGdeltEvents } from "@/lib/providers/gdelt-events";
import { fetchGdeltConflict, CONFLICT_QUERIES } from "@/lib/providers/gdelt-conflict";
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
  return runIngestor({ domain: "conflict", source: "gdelt-events+gdelt-doc+acled", job: "conflict-events" }, async (c) => {
    const gdeltSeen = new Set<string>();
    const store = (events: WorldEvent[], provider: string) => {
      const fresh = events.filter((e) => !gdeltSeen.has(e.id));
      for (const e of events) gdeltSeen.add(e.id);
      storeWorldEvents(fresh, provider, c);
    };

    // PRIMARY: GDELT 2.0 Events from the raw data CDN — structured, CAMEO-coded,
    // and (unlike the DOC API) reachable from datacenters, so this is what keeps
    // the vault fresh from CI.
    try { store(await fetchGdeltEvents(8), "gdelt-events"); }
    catch { c.failed++; }

    // BONUS: DOC-API media search adds headline-level context. It's datacenter-
    // firewalled (a no-op from CI) but contributes when the sync runs somewhere
    // GDELT's API is reachable; complementary single-word passes, deduped.
    for (const q of CONFLICT_QUERIES) {
      try { store(await fetchGdeltConflict(q, 250), "gdelt-conflict"); }
      catch { /* DOC API unreachable here — expected on datacenter egress */ }
    }

    // ACLED (curated, fatality-verified) merges on top when credentialed. Already
    // returns VaultEvent[] in canonical shape.
    if (acledConfigured()) {
      try {
        for (const e of await fetchAcledEvents({ days: opts.days ?? 14, limit: opts.limit ?? 800 })) {
          c.fetched++;
          upsertEvent(e);
          if (e.countryCode) linkEventCountry(e.id, e.countryCode, "reported");
          c.created++;
        }
      } catch {
        c.failed++;
      }
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
      // No reported country (GDELT gave a bare point) — fall back to the nearest
      // centroid, but reject open-ocean points >1500 km from any land centroid
      // so maritime noise doesn't inflate a random coastal nation.
      const near = nearestCountry(e.location, 1500);
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
