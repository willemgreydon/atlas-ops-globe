/**
 * Bulk-load the local Intelligence Vault (data/intelligence.db) into the Turso
 * primary.
 *
 * Why this exists: the app's normal write path is a libsql *embedded replica*,
 * which write-forwards every statement to the primary over the network (~tens of
 * ms each). That's fine for incremental syncs but ruinous for a ~30k-row seed
 * (hours). Here we instead read the local file directly and push rows to Turso
 * with @libsql/client `batch()` — hundreds of statements per HTTP round-trip.
 *
 * Schema is assumed to already exist on the primary (the `intel:*` CLI runs
 * migrations via ensureMigrated). Real tables use INSERT OR REPLACE (re-runnable);
 * FTS search tables are cleared then re-inserted. Run: pnpm db:seed-turso
 */
import "../bin/load-env";
import Database from "libsql";
import { createClient, type InStatement } from "@libsql/client";
import { resolve } from "node:path";

const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error("TURSO_DATABASE_URL / TURSO_DB_URL not set");

const localPath = process.env.INTEL_DB_PATH || resolve(process.cwd(), "data", "intelligence.db");
const local = new (Database as unknown as new (p: string) => {
  prepare(sql: string): { all(...a: unknown[]): Record<string, unknown>[] };
})(localPath);
const remote = createClient({ url, authToken });

const BATCH = 500;

// FTS5 virtual tables — copied via their retrievable columns. Their shadow
// tables (fts_*_data/_idx/_content/_docsize/_config) are managed by FTS and skipped.
const FTS = new Set(["fts_news", "fts_events", "fts_entities"]);

// Parents before children so the copy is valid even if FK enforcement is on.
const ORDER = [
  "sources", "countries", "entities", "persons", "organizations",
  "events", "news_articles", "news_stories", "relationships", "provenance",
  "sanctions", "space_objects", "vessels", "weather_observations",
  "market_observations", "economic_observations", "vulnerabilities",
  "aircraft", "airports", "ports", "change_log",
  "fts_entities", "fts_news", "fts_events",
];

function tableExists(name: string): boolean {
  return local.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").all(name).length > 0;
}
function columns(table: string): string[] {
  return local.prepare(`PRAGMA table_info(${table})`).all().map((r) => String(r.name));
}

async function copyTable(table: string): Promise<number> {
  if (!tableExists(table)) return 0;
  const cols = columns(table);
  const rows = local.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(",")} FROM ${table}`).all();
  if (FTS.has(table)) await remote.execute(`DELETE FROM ${table}`);
  if (rows.length === 0) return 0;

  const verb = FTS.has(table) ? "INSERT INTO" : "INSERT OR REPLACE INTO";
  const sql = `${verb} ${table} (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;

  for (let i = 0; i < rows.length; i += BATCH) {
    const stmts: InStatement[] = rows.slice(i, i + BATCH).map((row) => ({
      sql,
      args: cols.map((c) => (row[c] ?? null) as never),
    }));
    await remote.batch(stmts, "write");
    process.stdout.write(`\r  ${table.padEnd(22)} ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
  return rows.length;
}

async function main(): Promise<void> {
  console.log(`Seeding Turso primary from ${localPath}\n`);
  let total = 0;
  for (const table of ORDER) total += await copyTable(table);
  console.log(`\nDone. ${total.toLocaleString()} rows loaded into Turso.`);
  remote.close();
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
