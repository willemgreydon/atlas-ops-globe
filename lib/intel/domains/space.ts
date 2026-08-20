import { fetchCelestrakTLE } from "../providers/celestrak";
import { fetchSpaceTrack, spaceTrackConfigured } from "../providers/spacetrack";
import { log } from "@/lib/core/logger";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertSpaceObject } from "../repositories";
import type { VaultSpaceObject } from "../schemas";

/**
 * Satellite catalogue with SGP4-ready TLEs → space_objects. Prefers Space-Track
 * (authoritative, full catalogue) when SPACE_TRACK_USERNAME/PASSWORD are set,
 * else CelesTrak (free, curated groups). We store TLE lines + derived orbit
 * metadata, never propagated positions — the client propagates via SGP4.
 * `limit` caps how many are stored; truncation is logged, never silent.
 */
export async function ingestSpace(group = "active", limit = 1500): Promise<IngestReport> {
  const useSpaceTrack = spaceTrackConfigured();
  return runIngestor(
    { domain: "space", source: useSpaceTrack ? "spacetrack" : "celestrak", job: `catalog-${useSpaceTrack ? "spacetrack" : group}` },
    async (c) => {
      let objects: VaultSpaceObject[];
      if (useSpaceTrack) {
        objects = await fetchSpaceTrack(limit);
      } else {
        objects = await fetchCelestrakTLE(group);
      }
      const capped = objects.slice(0, limit);
      if (objects.length > capped.length) {
        log.warn("space catalog capped", { provider: useSpaceTrack ? "spacetrack" : "celestrak", records: objects.length, kept: capped.length });
      }
      for (const o of capped) {
        c.fetched++;
        upsertSpaceObject(o);
        c.created++;
      }
      c.skipped += objects.length - capped.length;
    },
  );
}
