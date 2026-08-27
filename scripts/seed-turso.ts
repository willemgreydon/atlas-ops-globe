/**
 * Bulk-load the local Intelligence Vault (data/intelligence.db) into the Turso
 * primary.
 *
 * Why this exists: the app's normal write path is a libsql *embedded replica*,
 * which write-forwards every statement to the primary over the network (~tens of
 * ms each). That's fine for incremental syncs but ruinous for a ~30k-row seed
 * (hours). Here we read the local file directly and push rows with
 * @libsql/client `batch()` — see lib/intel/turso-sync.ts (shared with the staged
 * sync path). Schema is assumed to already exist on the primary (the `intel:*`
 * CLI runs migrations via ensureMigrated). Run: pnpm db:seed-turso
 */
import "../bin/load-env";
import { resolve } from "node:path";
import { pushLocalToTurso } from "@/lib/intel/turso-sync";

const localPath = process.env.INTEL_DB_PATH || resolve(process.cwd(), "data", "intelligence.db");

async function main(): Promise<void> {
  console.log(`Seeding Turso primary from ${localPath}\n`);
  const total = await pushLocalToTurso(localPath, { log: true });
  console.log(`\nDone. ${total.toLocaleString()} rows loaded into Turso.`);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
