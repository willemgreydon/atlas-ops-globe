import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "@/lib/core/logger";

/**
 * Ingest-job framework. Wraps a domain sync with timing, structured logging,
 * per-record counters and failure isolation so one broken provider never aborts
 * a full `intel:update`. Reports roll up into the vault status manifest.
 */
export interface IngestCounts {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface IngestReport extends IngestCounts {
  domain: string;
  source: string;
  job: string;
  startedAt: string;
  durationMs: number;
  status: "success" | "partial" | "failed";
  error?: string;
}

export function newCounts(): IngestCounts {
  return { fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

export interface IngestorMeta {
  domain: string;
  source: string;
  job: string;
}

/**
 * Run a single ingestor. `run` mutates the provided counts. Any throw is caught
 * and turned into a FAILED report; a run that completes with `failed > 0` is
 * PARTIAL.
 */
export async function runIngestor(
  meta: IngestorMeta,
  run: (counts: IngestCounts) => Promise<void>,
): Promise<IngestReport> {
  const counts = newCounts();
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  let status: IngestReport["status"] = "success";
  let error: string | undefined;
  try {
    await run(counts);
    if (counts.failed > 0) status = "partial";
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);
  }
  const report: IngestReport = {
    ...counts,
    ...meta,
    startedAt,
    durationMs: Date.now() - t0,
    status,
    error,
  };
  log[status === "failed" ? "error" : "info"]("ingest", {
    provider: meta.source,
    domain: meta.domain,
    job: meta.job,
    status,
    records: counts.fetched,
    created: counts.created,
    updated: counts.updated,
    skipped: counts.skipped,
    failed: counts.failed,
    durationMs: report.durationMs,
    error,
  });
  return report;
}

const STATUS_PATH = resolve(process.cwd(), "intelligence", "_core", "manifests", "status.json");

/** Merge reports into the vault status manifest (intelligence/_core/manifests). */
export function writeStatus(reports: IngestReport[]): void {
  let existing: { domains?: Record<string, unknown> } = {};
  if (existsSync(STATUS_PATH)) {
    try { existing = JSON.parse(readFileSync(STATUS_PATH, "utf8")); } catch { existing = {}; }
  }
  const domains: Record<string, unknown> = { ...(existing.domains ?? {}) };
  for (const r of reports) {
    domains[r.domain] = {
      lastSync: r.startedAt,
      source: r.source,
      job: r.job,
      fetched: r.fetched,
      created: r.created,
      updated: r.updated,
      failed: r.failed,
      durationMs: r.durationMs,
      status: r.status === "success" ? "healthy" : r.status === "partial" ? "degraded" : "failed",
      error: r.error,
    };
  }
  mkdirSync(resolve(process.cwd(), "intelligence", "_core", "manifests"), { recursive: true });
  writeFileSync(STATUS_PATH, JSON.stringify({ lastRun: new Date().toISOString(), domains }, null, 2));
}

export function rollup(reports: IngestReport[]): "SUCCESS" | "PARTIAL" | "FAILED" {
  if (reports.every((r) => r.status === "success")) return "SUCCESS";
  if (reports.every((r) => r.status === "failed")) return "FAILED";
  return "PARTIAL";
}
