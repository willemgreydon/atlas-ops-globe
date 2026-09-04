/**
 * Build the read-only vault snapshot committed to the repo at
 * data/vault-snapshot.db and shipped into the intelligence API serverless
 * functions (next.config `outputFileTracingIncludes`).
 *
 * It's the fallback `getReadDb()` serves when the Turso free-tier read quota is
 * blocked (403) or a cold replica hasn't pulled — so analytics and the
 * vault-backed panels stay up instead of degrading to empty. See lib/intel/db.ts.
 *
 * Source, freshest-first:
 *   1. Turso primary — pulled into a temp embedded replica (when reads work).
 *   2. data/replica.db — the last-pulled embedded replica.
 *   3. data/intelligence.db — the local dev vault.
 *
 * Two modes:
 *   • FULL rebuild — when the source has the core cross-domain reference tables
 *     (countries, sanctions). `VACUUM INTO` a clean, compact single file.
 *   • OVERLAY — when the source is a PARTIAL replica (the staged CI sync on a
 *     fresh runner: its initial Turso pull 403s while reads are blocked, so
 *     data/replica.db holds ONLY the domains just ingested) AND a full snapshot
 *     already exists AND `SNAPSHOT_MERGE_DOMAINS` names the freshly-synced
 *     domains: start from the existing snapshot and INSERT OR REPLACE just those
 *     domains' tables from the partial source. Reference data stays frozen; the
 *     fresh media domains (news/conflict/disasters) refresh — so the committed
 *     snapshot doesn't drift stale even while Turso reads are blocked.
 *
 * A full rebuild happens automatically the moment Turso reads unblock (the pull
 * succeeds → complete source). Run: pnpm db:snapshot
 */
import "../bin/load-env";
import Database from "libsql";
import { copyFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { tablesForDomains } from "@/lib/intel/turso-sync";

type Row = { c: number; m: string; name: string };
type Handle = {
  exec(sql: string): void;
  prepare(sql: string): { get(...a: unknown[]): Row; all(...a: unknown[]): Row[] };
  close(): void;
  sync(): void;
};
const Libsql = Database as unknown as new (path: string, opts?: Record<string, unknown>) => Handle;

const OUT = resolve(process.cwd(), "data", "vault-snapshot.db");
const MIN_COUNTRIES = Number(process.env.SNAPSHOT_MIN_COUNTRIES ?? 100);
const MIN_SANCTIONS = Number(process.env.SNAPSHOT_MIN_SANCTIONS ?? 1000);
// FTS5 virtual tables — their shadow tables aren't plain tables, so overlaying
// them via INSERT..SELECT is unsafe. Skip them in overlay (search over brand-new
// rows is briefly stale; a full rebuild rebuilds them). Matches turso-sync's set.
const FTS = new Set(["fts_news", "fts_events", "fts_entities"]);
const mergeDomains = (process.env.SNAPSHOT_MERGE_DOMAINS ?? "").trim().split(/\s+/).filter(Boolean);

/** Pull the Turso primary into a throwaway embedded replica; null if unreachable. */
function tursoSource(): string | null {
  // CI ingests against a local DB and mirrors to Turso separately, so it skips
  // the pull entirely — keeps the snapshot build fully read-free (no 403 noise).
  if (process.env.SNAPSHOT_SKIP_TURSO === "1") return null;
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
  // Freshest local first. An explicit INTEL_DB_PATH (CI's local-ingest DB) wins;
  // then the last embedded replica; then the dev vault.
  const candidates = [process.env.INTEL_DB_PATH, "data/replica.db", "data/intelligence.db"].filter(Boolean) as string[];
  for (const f of candidates) {
    const p = resolve(process.cwd(), f);
    if (existsSync(p)) { console.log(`source: ${f}`); return p; }
  }
  throw new Error("no vault source found (Turso unreachable, no local .db)");
}

function counts(dbPath: string): { countries: number; sanctions: number } {
  const db = new Libsql(dbPath);
  const c = (t: string) => { try { return db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch { return 0; } };
  const out = { countries: c("countries"), sanctions: c("sanctions") };
  db.close();
  return out;
}

function report(path: string, mode: string): void {
  const db = new Libsql(path);
  const n = (t: string) => { try { return db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch { return "-"; } };
  console.log(`\nsnapshot built (${mode}): ${path}`);
  for (const t of ["countries", "events", "news_articles", "persons", "organizations", "relationships", "sanctions", "vulnerabilities", "space_objects", "entities"]) {
    console.log(`  ${t.padEnd(22)} ${n(t)}`);
  }
  console.log(`  latestEvent            ${db.prepare("SELECT MAX(occurred_at) AS m FROM events").get().m}`);
  db.close();
}

/** Clean rebuild: compact the source into a fresh single-file snapshot. */
function fullRebuild(src: string): void {
  for (const s of [OUT, `${OUT}-wal`, `${OUT}-shm`]) if (existsSync(s)) rmSync(s);
  const db = new Libsql(src);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.exec(`VACUUM INTO '${OUT.replace(/'/g, "''")}'`);
  db.close();
  report(OUT, "full");
}

/** Overlay the freshly-synced domains from a partial source onto the snapshot. */
function overlay(src: string, domains: string[]): void {
  const tables = tablesForDomains(domains).filter((t) => !FTS.has(t));
  if (tables.length === 0) { console.warn(`no overlay tables for domains: ${domains.join(" ")} — keeping snapshot`); return; }
  const tmp = join(mkdtempSync(join(tmpdir(), "vault-merge-")), "merged.db");
  copyFileSync(OUT, tmp);
  const db = new Libsql(tmp);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(`ATTACH '${src.replace(/'/g, "''")}' AS fresh`);
  let n = 0;
  for (const t of tables) {
    // Same schema on both sides → positional SELECT * aligns. INSERT OR REPLACE
    // by PK adds/updates, never deletes — reference rows in the snapshot survive.
    try { db.exec(`INSERT OR REPLACE INTO ${t} SELECT * FROM fresh.${t}`); n++; }
    catch (e) { console.warn(`  overlay ${t} skipped: ${(e as Error).message}`); }
  }
  db.exec("DETACH fresh");
  for (const s of [OUT, `${OUT}-wal`, `${OUT}-shm`]) if (existsSync(s)) rmSync(s);
  db.exec(`VACUUM INTO '${OUT.replace(/'/g, "''")}'`);
  db.close();
  console.log(`overlaid ${n} table(s) from domains [${domains.join(" ")}] onto the existing full snapshot`);
  report(OUT, `overlay:${domains.join("+")}`);
}

const src = pickSource();
const { countries, sanctions } = counts(src);
const srcComplete = countries >= MIN_COUNTRIES && sanctions >= MIN_SANCTIONS;
const haveSnapshot = existsSync(OUT);

if (srcComplete) {
  fullRebuild(src);
} else if (haveSnapshot && mergeDomains.length) {
  console.warn(`source is partial (countries=${countries}, sanctions=${sanctions}) — overlaying fresh domains onto the existing snapshot`);
  overlay(src, mergeDomains);
} else if (haveSnapshot) {
  console.warn(
    `source incomplete (countries=${countries} < ${MIN_COUNTRIES} or sanctions=${sanctions} < ${MIN_SANCTIONS}) ` +
    `and no SNAPSHOT_MERGE_DOMAINS given — keeping the existing snapshot untouched.`,
  );
  process.exit(0);
} else {
  throw new Error(`source incomplete (countries=${countries}, sanctions=${sanctions}) and no existing snapshot to fall back on`);
}
