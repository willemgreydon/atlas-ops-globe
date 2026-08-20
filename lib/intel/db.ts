import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "./migrations";

// `node:sqlite` is a recent Node built-in that bundlers (Vite 5.4, Turbopack)
// fail to resolve statically. `process.getBuiltinModule` (Node 22.3+) loads it
// at runtime without a static import/require, so it works uniformly in Next,
// tsx and vitest without tripping any bundler.
type DatabaseSync = DatabaseSyncType;
const { DatabaseSync } = (
  process as NodeJS.Process & { getBuiltinModule(id: string): typeof import("node:sqlite") }
).getBuiltinModule("node:sqlite");

/**
 * SQLite storage for the Intelligence Vault, backed by Node's built-in
 * `node:sqlite` (no native dependency). One handle per process; migrations run
 * on first open. Override the path with INTEL_DB_PATH (`:memory:` for tests).
 */
let handle: DatabaseSync | null = null;

export function dbPath(): string {
  return process.env.INTEL_DB_PATH ?? resolve(process.cwd(), "data", "intelligence.db");
}

export function getDb(): DatabaseSync {
  if (handle) return handle;
  const path = dbPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  runMigrations(db);
  handle = db;
  return db;
}

/** For tests: open a fresh in-memory DB isolated from the process singleton. */
export function openMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  handle?.close();
  handle = null;
}
