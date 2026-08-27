/**
 * Fast bulk copy of a local libsql file → the Turso primary via @libsql/client
 * `batch()` (hundreds of statements per HTTP round-trip).
 *
 * This is the counter to the embedded-replica write path, which write-forwards
 * every statement individually (~seconds each against a remote primary — a news
 * sync measured ~27 min). Used by both the one-off seed (`db:seed-turso`) and
 * the staged sync (`INTEL_STAGED=1`, see bin/intel.ts): run the ingestors
 * against a local pulled copy, then push the whole vault back here in ~2 min.
 *
 * Real tables use INSERT OR REPLACE (re-runnable). Rows only present on the
 * primary are never deleted here (the local copy is a superset pulled first), so
 * a push can't lose data. FTS5 virtual tables are cleared then re-inserted.
 */
import Database from "libsql";
import { createClient, type InStatement } from "@libsql/client";

interface LocalReader {
  prepare(sql: string): { all(...a: unknown[]): Record<string, unknown>[] };
  close?(): void;
}
const Libsql = Database as unknown as new (p: string) => LocalReader;

const BATCH = 500;

// FTS5 virtual tables — copied via their retrievable columns; the shadow tables
// (fts_*_data/_idx/_content/_docsize/_config) are managed by FTS and skipped.
const FTS = new Set(["fts_news", "fts_events", "fts_entities"]);

// Parents before children so the copy is valid even with FK enforcement on.
export const COPY_ORDER = [
  "sources", "countries", "entities", "persons", "organizations",
  "events", "news_articles", "news_stories", "relationships", "provenance",
  "sanctions", "space_objects", "vessels", "weather_observations",
  "market_observations", "economic_observations", "vulnerabilities",
  "aircraft", "airports", "ports", "change_log",
  "fts_entities", "fts_news", "fts_events",
];

type RemoteClient = ReturnType<typeof createClient>;

function tableExists(local: LocalReader, name: string): boolean {
  return local.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").all(name).length > 0;
}
function columns(local: LocalReader, table: string): string[] {
  return local.prepare(`PRAGMA table_info(${table})`).all().map((r) => String(r.name));
}

async function copyTable(local: LocalReader, remote: RemoteClient, table: string, log = false): Promise<number> {
  if (!tableExists(local, table)) return 0;
  const cols = columns(local, table);
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
    if (log) process.stdout.write(`\r  ${table.padEnd(22)} ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  if (log) process.stdout.write("\n");
  return rows.length;
}

/** Push every vault table from a local libsql file to the Turso primary. */
export async function pushLocalToTurso(
  localPath: string,
  opts: { url?: string; authToken?: string; log?: boolean } = {},
): Promise<number> {
  const url = opts.url ?? process.env.TURSO_DATABASE_URL ?? process.env.TURSO_DB_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL / TURSO_DB_URL not set");
  const local = new Libsql(localPath);
  const remote = createClient({ url, authToken: opts.authToken ?? process.env.TURSO_AUTH_TOKEN });
  try {
    let total = 0;
    for (const table of COPY_ORDER) total += await copyTable(local, remote, table, opts.log);
    return total;
  } finally {
    remote.close();
    local.close?.();
  }
}
