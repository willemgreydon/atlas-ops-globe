import { fetchAcledEvents, acledConfigured } from "../providers/acled";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertEvent } from "../repositories";
import { linkEventCountry } from "../enrich";

/**
 * Conflict & unrest via ACLED (political violence, protests, strategic
 * developments) → canonical events (kind="conflict"). Credential-gated: without
 * ACLED_USERNAME/ACLED_PASSWORD the job fails fast with a clear OFFLINE message.
 * Neutral labelling throughout — ACLED's own event/disorder types are used as-is.
 */
export async function ingestConflict(opts: { days?: number; limit?: number } = {}): Promise<IngestReport> {
  return runIngestor({ domain: "conflict", source: "acled", job: "acled-events" }, async (c) => {
    if (!acledConfigured()) {
      throw new Error("ACLED_USERNAME/ACLED_PASSWORD not set — conflict is credential-required (OFFLINE)");
    }
    const events = await fetchAcledEvents({ days: opts.days ?? 14, limit: opts.limit ?? 800 });
    for (const e of events) {
      c.fetched++;
      upsertEvent(e);
      if (e.countryCode) linkEventCountry(e.id, e.countryCode, "reported");
      c.created++;
    }
    if (events.length === 0) c.skipped++;
  });
}
