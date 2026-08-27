import { describe, it, expect, afterEach } from "vitest";
import Database from "libsql";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runMigrations } from "@/lib/intel/migrations";
import { pushLocalToTurso } from "@/lib/intel/turso-sync";

/**
 * Verifies the batch push engine copies a local libsql file into a "remote"
 * (a second local file addressed via a file: URL — @libsql/client treats it the
 * same as Turso for writes) without touching any real primary.
 */
const Libsql = Database as unknown as new (p: string) => {
  exec(s: string): void;
  prepare(s: string): { run(...a: unknown[]): void; get(...a: unknown[]): unknown; all(...a: unknown[]): unknown[] };
  close(): void;
};

const stamp = `${process.pid}-${Math.round(performance.now())}`;
const srcPath = resolve(tmpdir(), `atlas-src-${stamp}.db`);
const dstPath = resolve(tmpdir(), `atlas-dst-${stamp}.db`);

afterEach(() => {
  for (const p of [srcPath, dstPath]) {
    try { rmSync(p); } catch { /* ignore */ }
  }
});

describe("pushLocalToTurso", () => {
  it("bulk-copies rows from a local file to the remote via INSERT OR REPLACE", async () => {
    // Source: migrated schema + a couple of rows.
    const src = new Libsql(srcPath);
    runMigrations(src as never);
    src.prepare("INSERT INTO countries (iso2, iso3, name) VALUES (?,?,?)").run("ZZ", "ZZZ", "Testland");
    src.prepare(
      "INSERT INTO events (id, kind, title, occurred_at) VALUES (?,?,?,?)",
    ).run("evt:1", "disaster", "Test quake", "2026-08-27T00:00:00Z");
    src.close();

    // Destination: migrated schema, but a STALE country row that the push must overwrite.
    const dst = new Libsql(dstPath);
    runMigrations(dst as never);
    dst.prepare("INSERT INTO countries (iso2, iso3, name) VALUES (?,?,?)").run("ZZ", "ZZZ", "Old Name");
    dst.close();

    const n = await pushLocalToTurso(srcPath, { url: `file:${dstPath}` });
    expect(n).toBeGreaterThanOrEqual(2);

    const check = new Libsql(dstPath);
    const country = check.prepare("SELECT name FROM countries WHERE iso2=?").get("ZZ") as { name: string };
    const evt = check.prepare("SELECT title FROM events WHERE id=?").get("evt:1") as { title: string };
    check.close();
    expect(country.name).toBe("Testland"); // overwritten, not duplicated
    expect(evt.title).toBe("Test quake");
  });
});
