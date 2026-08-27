import Database from "libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "./migrations";

/**
 * Storage for the Intelligence Vault.
 *
 * Driver: Turso's `libsql` — a SQLite-compatible engine with a synchronous,
 * better-sqlite3-style API. This keeps every query call-site synchronous while
 * letting the same code run three ways:
 *
 *   - Local file (dev / tests / CLI): `new Database(path)`.
 *   - Turso embedded replica (Vercel): reads hit a local copy of the primary
 *     (fast, no per-query network); writes + `sync()` propagate to Turso. This
 *     is what makes the vault work on Vercel's read-only, ephemeral filesystem —
 *     the replica lives in the only writable path, `/tmp`.
 *
 * Configure the remote with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Without them
 * we fall back to a local file at INTEL_DB_PATH (default ./data/intelligence.db).
 */

/** Minimal structural surface the query layer relies on — driver-agnostic. */
export interface DbStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}
export interface Db {
  prepare(sql: string): DbStatement;
  exec(sql: string): void;
  close(): void;
  sync?(): void;
}

type LibsqlCtor = new (path: string, opts?: Record<string, unknown>) => Db;
const Libsql = Database as unknown as LibsqlCtor;

let handle: Db | null = null;

export function dbPath(): string {
  // Use `||` not `??`: an empty INTEL_DB_PATH (e.g. a blank line in .env.local)
  // must fall back to the default, not become an empty path.
  return process.env.INTEL_DB_PATH || resolve(process.cwd(), "data", "intelligence.db");
}

/** The configured Turso primary URL, if any (accepts either env var name). */
export function tursoUrl(): string | undefined {
  return process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL || undefined;
}

/** True when a Turso primary is configured (i.e. we run as an embedded replica). */
export function isRemote(): boolean {
  return !!tursoUrl();
}

function replicaPath(): string {
  if (process.env.INTEL_REPLICA_PATH) return process.env.INTEL_REPLICA_PATH;
  // On Vercel /tmp is the only writable location; keep it beside data locally.
  return process.env.VERCEL ? "/tmp/atlas-intel.db" : resolve(process.cwd(), "data", "replica.db");
}

function open(): Db {
  const url = tursoUrl();
  if (url) {
    const path = replicaPath();
    mkdirSync(dirname(path), { recursive: true });
    const db = new Libsql(path, { syncUrl: url, authToken: process.env.TURSO_AUTH_TOKEN });
    // Pull the latest primary state into the local replica. Non-fatal on cold
    // networks — we then serve whatever the replica already has.
    try {
      db.sync?.();
    } catch {
      /* offline / first boot: serve local replica as-is */
    }
    return db;
  }
  const path = dbPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  return new Libsql(path);
}

function applyPragmas(db: Db): void {
  // Replica journal mode is managed by libsql; only these are always safe.
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (!isRemote()) db.exec("PRAGMA journal_mode = WAL;");
  } catch {
    /* pragmas are best-effort */
  }
}

export function getDb(): Db {
  if (handle) return handle;
  const db = open();
  applyPragmas(db);
  // Local DBs migrate themselves. The Turso primary is migrated out-of-band by
  // the seed/sync CLI (see ensureMigrated) — the read path must not attempt
  // schema writes on every cold start.
  if (!isRemote()) runMigrations(db);
  handle = db;
  return db;
}

/** Run migrations against the current handle — used by the CLI/seed on Turso. */
export function ensureMigrated(): number {
  return runMigrations(getDb());
}

/** Force a pull from the Turso primary into the local replica (no-op locally). */
export function syncDb(): void {
  handle?.sync?.();
}

/** For tests: open a fresh in-memory DB isolated from the process singleton. */
export function openMemoryDb(): Db {
  const db = new Libsql(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  handle?.close();
  handle = null;
}
