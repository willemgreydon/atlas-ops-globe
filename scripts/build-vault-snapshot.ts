/**
 * Build the read-only vault snapshot committed to the repo at
 * data/vault-snapshot.db and shipped into the intelligence API serverless
 * functions (next.config `outputFileTracingIncludes`).
 *
 * It's the fallback `getReadDb()` serves when the Turso free-tier read quota is
 * blocked (403) or a cold replica hasn't pulled — so analytics and the
 * vault-backed panels stay up (data frozen at snapshot time) instead of
 * degrading to empty. See lib/intel/db.ts.
 *
 * Source, freshest-first:
 *   1. Turso primary — pulled into a temp embedded replica (when reads work).
 *   2. data/replica.db — the last-pulled embedded replica.
 *   3. data/intelligence.db — the local dev vault.
 * The chosen source is WAL-checkpointed and `VACUUM INTO`'d to a clean, compact,
 * single-file DB (no WAL sidecars) so libsql can open it read-only-ish anywhere.
 *
 * Run: pnpm db:snapshot
 */
import "../bin/load-env";
import Database from "libsql";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

type Handle = { exec(sql: string): void; prepare(sql: string): { get(...a: unknown[]): { c: number; m: string } }; sync(): void; close(): void };
const Libsql = Database as unknown as new (path: string, opts?: Record<string, unknown>) => Handle;

const OUT = resolve(process.cwd(), "data", "vault-snapshot.db");

/** Pull the Turso primary into a throwaway embedded replica; null if unreachable. */
function tursoSource(): string | null {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL;
  if (!url) return null;
  const path = join(mkdtempSync(join(tmpdir(), "vault-snap-")), "pull.db");
  try {
    const r = new Libsql(path, { syncUrl: url, authToken: process.env.TURSO_AUTH_TOKEN });
    r.sync();
    r.close();
    console.log("source: Turso primary (fresh pull)");
    return path;
  } catch (e) {
    console.warn(`Turso pull failed (${(e as Error).message}) — falling back to a local source`);
    return null;
  }
}

function pickSource(): string {
  const fromTurso = tursoSource();
  if (fromTurso) return fromTurso;
  for (const f of ["data/replica.db", "data/intelligence.db"]) {
    const p = resolve(process.cwd(), f);
    if (existsSync(p)) { console.log(`source: ${f}`); return p; }
  }
  throw new Error("no vault source found (Turso unreachable, no local .db)");
}

const src = pickSource();
for (const s of [OUT, `${OUT}-wal`, `${OUT}-shm`]) if (existsSync(s)) rmSync(s);

const db = new Libsql(src);
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.exec(`VACUUM INTO '${OUT.replace(/'/g, "''")}'`);
db.close();

const snap = new Libsql(OUT);
const n = (t: string) => snap.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
console.log(`\nsnapshot built: ${OUT}`);
for (const t of ["countries", "events", "news_articles", "persons", "organizations", "relationships", "sanctions", "vulnerabilities", "space_objects", "entities"]) {
  console.log(`  ${t.padEnd(22)} ${n(t)}`);
}
console.log(`  latestEvent            ${snap.prepare("SELECT MAX(occurred_at) AS m FROM events").get().m}`);
snap.close();
