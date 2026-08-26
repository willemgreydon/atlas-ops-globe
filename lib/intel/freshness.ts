/**
 * Centralized data-freshness policy (mission §21).
 *
 * The vault-read API previously returned every row as `status: "live"` regardless
 * of how old the underlying observation was, and maritime/markets derived status
 * from *credential presence* rather than data recency (audit P0-1). That let stale
 * data masquerade as live — a direct violation of the core trust invariant (§38).
 *
 * Freshness is domain-specific: a 6-hour-old earthquake is fine, a 6-hour-old
 * market quote is not. Each domain declares a soft `aging` threshold and a hard
 * `stale` threshold. `CACHED` is deliberately kept distinct from `STALE`
 * elsewhere; here we only classify recency of the *data itself*.
 */

export type FreshnessState = "fresh" | "aging" | "stale" | "unknown";

/** Time-sensitive vault domains. Reference data (countries, sanctions, persons,
 *  organizations) is intentionally excluded — it is not a time-series and has no
 *  meaningful "staleness". */
export type FreshnessDomain =
  | "disaster"
  | "event"
  | "conflict"
  | "news"
  | "weather"
  | "space"
  | "markets"
  | "vessels"
  | "cyber";

interface Thresholds {
  /** Older than this → aging (still useful, but no longer fresh). */
  agingMs: number;
  /** Older than this → stale (should be visibly flagged; may be unreliable). */
  staleMs: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Per-domain thresholds. Tuned to each source's real update cadence (§21). */
const THRESHOLDS: Record<FreshnessDomain, Thresholds> = {
  markets: { agingMs: 5 * MIN, staleMs: 60 * MIN }, // delayed quotes; minutes matter
  vessels: { agingMs: 30 * MIN, staleMs: 6 * HOUR }, // AIS contacts are sparse
  weather: { agingMs: 90 * MIN, staleMs: 6 * HOUR },
  news: { agingMs: 3 * HOUR, staleMs: 24 * HOUR },
  disaster: { agingMs: 6 * HOUR, staleMs: 72 * HOUR },
  event: { agingMs: 6 * HOUR, staleMs: 72 * HOUR },
  space: { agingMs: 2 * DAY, staleMs: 7 * DAY }, // TLE epoch age
  cyber: { agingMs: 2 * DAY, staleMs: 21 * DAY },
  conflict: { agingMs: 24 * HOUR, staleMs: 7 * DAY }, // ACLED lags days
};

export interface FreshnessInfo {
  domain: FreshnessDomain;
  state: FreshnessState;
  /** ISO timestamp of the newest record in the response, or null if none. */
  latestObservedAt: string | null;
  /** now − latestObservedAt, in ms, or null. */
  ageMs: number | null;
}

/** Classify the recency of the newest observation for a domain. */
export function classifyFreshness(
  latestMs: number | null,
  domain: FreshnessDomain,
  nowMs: number = Date.now(),
): FreshnessState {
  if (latestMs == null || !Number.isFinite(latestMs)) return "unknown";
  const age = nowMs - latestMs;
  const t = THRESHOLDS[domain];
  if (age <= t.agingMs) return "fresh";
  if (age <= t.staleMs) return "aging";
  return "stale";
}

/** Newest parseable timestamp (ms) across rows for the given field, or null. */
export function newestTimestamp(rows: Array<Record<string, unknown>>, field: string): number | null {
  let newest: number | null = null;
  for (const r of rows) {
    const v = r[field];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const ms = typeof v === "number" ? v : Date.parse(v);
    if (!Number.isFinite(ms)) continue;
    if (newest == null || ms > newest) newest = ms;
  }
  return newest;
}

/** Compute a {@link FreshnessInfo} for a page of rows. */
export function freshnessFor(
  rows: Array<Record<string, unknown>>,
  domain: FreshnessDomain,
  tsField: string,
  nowMs: number = Date.now(),
): FreshnessInfo {
  const latestMs = newestTimestamp(rows, tsField);
  return {
    domain,
    state: classifyFreshness(latestMs, domain, nowMs),
    latestObservedAt: latestMs != null ? new Date(latestMs).toISOString() : null,
    ageMs: latestMs != null ? Math.max(0, nowMs - latestMs) : null,
  };
}

/** Attach freshness to a `{ data, page }` result for a route response. */
export function attachFreshness<R extends { data: Array<Record<string, unknown>> }>(
  result: R,
  domain: FreshnessDomain,
  tsField: string,
): R & { freshness: FreshnessInfo } {
  return { ...result, freshness: freshnessFor(result.data, domain, tsField) };
}
