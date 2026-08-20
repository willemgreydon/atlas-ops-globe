import { fetchOpenSkyStates } from "@/lib/providers/opensky";
import { getDb } from "../db";
import { runIngestor, type IngestReport } from "../ingest";

/**
 * OpenSky aircraft SNAPSHOT. Live telemetry is high-volume and non-committal —
 * we store only the latest position per aircraft (upsert) in the gitignored DB,
 * bounded by `limit`. Historical trajectories/downsampling are future work.
 */
export async function ingestAviationSnapshot(limit = 2000): Promise<IngestReport> {
  return runIngestor({ domain: "aviation", source: "opensky", job: "aircraft-snapshot" }, async (c) => {
    const states = (await fetchOpenSkyStates()).slice(0, limit);
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO aircraft (id, icao24, callsign, country, lat, lon, alt, velocity, heading, on_ground, last_contact, provenance, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET callsign=excluded.callsign, lat=excluded.lat, lon=excluded.lon,
         alt=excluded.alt, velocity=excluded.velocity, heading=excluded.heading,
         on_ground=excluded.on_ground, last_contact=excluded.last_contact, updated_at=excluded.updated_at`,
    );
    const now = new Date().toISOString();
    for (const a of states) {
      c.fetched++;
      stmt.run(
        a.id, a.id.replace("aircraft:", ""), a.callsign ?? null, a.country ?? null,
        a.position.lat, a.position.lon, a.position.alt ?? null, a.velocityMs ?? null,
        a.headingDeg ?? null, a.onGround ? 1 : 0, a.lastContact,
        JSON.stringify(a.provenance ?? []), now,
      );
      c.created++;
    }
  });
}
