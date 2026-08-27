/**
 * Fast aircraft snapshot → Turso.
 *
 * OpenSky blocks Vercel's egress, so the live globe can't fetch it directly; but
 * GitHub's runners CAN reach OpenSky. This script (run from the aircraft-sync
 * workflow) fetches the current worldwide states and writes them to the Turso
 * `aircraft` table, which /api/aircraft then serves.
 *
 * It uses @libsql/client `batch()` (hundreds of statements per round-trip)
 * instead of the embedded-replica write path — the latter write-forwards each
 * statement and takes ~20 min for 2k rows; this takes seconds.
 *
 * Snapshot semantics: clear the table, then insert the fresh set, all in bounded
 * batches. Run: pnpm sync:aircraft
 */
import "../bin/load-env";
import { createClient, type InStatement } from "@libsql/client";
import { fetchOpenSkyStates } from "@/lib/providers/opensky";

const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL || "";
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error("TURSO_DATABASE_URL / TURSO_DB_URL not set");

const LIMIT = 3000;
const BATCH = 500;

async function main(): Promise<void> {
  const states = (await fetchOpenSkyStates()).slice(0, LIMIT);
  console.log(`Fetched ${states.length} aircraft from OpenSky.`);
  if (states.length === 0) {
    console.log("No aircraft returned — leaving existing snapshot untouched.");
    return;
  }

  const client = createClient({ url, authToken });
  const now = new Date().toISOString();

  const insert = `INSERT OR REPLACE INTO aircraft
    (id, icao24, callsign, country, lat, lon, alt, velocity, heading, on_ground, last_contact, provenance, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  const rows: InStatement[] = states.map((a) => ({
    sql: insert,
    args: [
      a.id,
      a.id.replace("aircraft:", ""),
      a.callsign ?? null,
      a.country ?? null,
      a.position.lat,
      a.position.lon,
      a.position.alt ?? null,
      a.velocityMs ?? null,
      a.headingDeg ?? null,
      a.onGround ? 1 : 0,
      a.lastContact,
      JSON.stringify(a.provenance ?? []),
      now,
    ] as never[],
  }));

  // Fresh snapshot: drop the previous set, then insert the new one in batches.
  await client.batch([{ sql: "DELETE FROM aircraft", args: [] }], "write");
  for (let i = 0; i < rows.length; i += BATCH) {
    await client.batch(rows.slice(i, i + BATCH), "write");
    process.stdout.write(`\r  wrote ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
  client.close();
  console.log(`Aircraft snapshot updated (${states.length} rows) at ${now}.`);
}

main().catch((err) => {
  console.error("aircraft sync failed:", err);
  process.exit(1);
});
