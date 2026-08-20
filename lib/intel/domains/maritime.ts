import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fetchVesselsInBounds, marineTrafficConfigured } from "../providers/marinetraffic";
import { domainPath } from "../paths";
import { CHOKEPOINTS } from "../geo/chokepoints";
import { mapPool, limiter } from "../pool";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertVessel } from "../repositories";
import type { VaultVessel } from "../schemas";

/**
 * Maritime AIS via MarineTraffic. Scans strategic chokepoint geofences, stores
 * vessel positions, and writes per-chokepoint transit counts. Credential-gated:
 * without MARINETRAFFIC_API_KEY the job fails fast with a clear OFFLINE message
 * (never mock-as-live). Uses neutral terminology — an AIS gap is a "signal gap",
 * not an accusation.
 */
export async function ingestMaritime(): Promise<IngestReport> {
  return runIngestor({ domain: "maritime", source: "marinetraffic", job: "chokepoint-scan" }, async (c) => {
    if (!marineTrafficConfigured()) {
      throw new Error("MARINETRAFFIC_API_KEY not set — maritime is credential-required (OFFLINE)");
    }

    const stats: Record<string, { name: string; vessels: number }> = {};
    // Serial with pacing — MarineTraffic is credit-metered; be courteous.
    await mapPool(CHOKEPOINTS, 1, async (cp) => {
      await limiter.wait("marinetraffic", 1500);
      let vessels: VaultVessel[] = [];
      try {
        vessels = await fetchVesselsInBounds(cp.bounds, { timespanMin: 60 });
      } catch {
        c.failed++;
        stats[cp.id] = { name: cp.name, vessels: 0 };
        return;
      }
      for (const v of vessels) {
        c.fetched++;
        upsertVessel(v);
        c.created++;
      }
      stats[cp.id] = { name: cp.name, vessels: vessels.length };
    });

    // Persist chokepoint transit snapshot (gitignored).
    const dir = domainPath("maritime", "snapshots");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "chokepoints-latest.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), chokepoints: stats }, null, 2),
    );
  });
}
