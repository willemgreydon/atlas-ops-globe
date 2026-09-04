/**
 * Push ONLY the given domains' tables from the local vault (data/intelligence.db)
 * to the Turso primary via @libsql/client `batch()` — a pure WRITE path (no
 * embedded-replica pull, so it never triggers a read).
 *
 * Why this exists: while Turso's free-tier READ quota is blocked, the staged
 * sync can't run — constructing an embedded replica does an initial pull that
 * 403s. CI instead ingests against a local DB seeded from the committed snapshot
 * (no Turso read) and calls this to mirror the fresh rows back to the primary so
 * live reads return fresh data once the read block lifts. Writes aren't affected
 * by the read block; if they ever are, the caller runs this best-effort.
 *
 * Run: pnpm db:push-delta <domain...>   (e.g. pnpm db:push-delta news conflict)
 */
import "../bin/load-env";
import { resolve } from "node:path";
import { pushLocalToTurso, tablesForDomains } from "@/lib/intel/turso-sync";

const domains = process.argv.slice(2).filter(Boolean);
if (domains.length === 0) { console.error("usage: db:push-delta <domain...>"); process.exit(1); }

const localPath = process.env.INTEL_DB_PATH || resolve(process.cwd(), "data", "intelligence.db");
const tables = tablesForDomains(domains);
if (tables.length === 0) { console.error(`no tables for domains: ${domains.join(" ")}`); process.exit(1); }

async function main(): Promise<void> {
  console.log(`Pushing [${domains.join(" ")}] → Turso primary from ${localPath}`);
  console.log(`  tables: ${tables.join(", ")}`);
  const n = await pushLocalToTurso(localPath, { log: true, tables });
  console.log(`\nDone. ${n.toLocaleString()} rows pushed.`);
}

main().catch((err) => {
  console.error(`push-delta failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
