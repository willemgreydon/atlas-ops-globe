import { fetchOfacSdn } from "../providers/ofac";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertSanction } from "../repositories";

/**
 * OFAC SDN sanctions list → sanctions table. A reference dataset, not a matching
 * engine: we store designations with hard identifiers where present. Non-spatial
 * (surfaced in panels/search, never as fabricated map points).
 */
export async function ingestSanctions(): Promise<IngestReport> {
  return runIngestor({ domain: "sanctions", source: "ofac", job: "sdn-load" }, async (c) => {
    const records = await fetchOfacSdn();
    for (const s of records) {
      c.fetched++;
      upsertSanction(s);
      c.created++;
    }
    if (records.length === 0) c.skipped++;
  });
}
