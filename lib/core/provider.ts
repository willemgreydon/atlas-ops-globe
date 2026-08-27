import type { DataStatus, ProviderResult } from "@/types/domain";
import { cache, isFresh } from "./cache";
import { log } from "./logger";

/**
 * Provider framework.
 *
 * A provider adapter normalizes one external source into domain records. It
 * knows nothing about caching, HTTP status envelopes, or the UI. `runProvider`
 * wraps a definition with:
 *   - TTL caching (stale-while-error)
 *   - honest {@link DataStatus} (live / cached / mock / offline)
 *   - graceful degradation (stale cache -> mock, never a thrown 500)
 *   - structured logging
 *
 * Rendering code and API routes only ever see a {@link ProviderResult}. They
 * never learn whether the data came from OpenSky, a cache, or a mock — only its
 * status. This is the isolation the architecture depends on.
 */
export interface ProviderDefinition<T> {
  /** Stable key, e.g. "opensky". Also the default cache key. */
  key: string;
  /** Human label for docs/registry. */
  label: string;
  /** How long a successful fetch stays "live" before we refetch. */
  ttlMs: number;
  /** 0..1 reliability weight fed to the confidence engine. */
  reliability?: number;
  /**
   * When false, the provider is not configured (e.g. missing credential). We
   * skip the upstream call and serve mock data flagged OFFLINE — never LIVE.
   */
  enabled?: boolean;
  /** Fetch + validate + normalize fresh records from upstream. */
  fetch: () => Promise<T>;
  /** Demo/empty fallback when upstream fails and no cache exists. */
  mock: () => T;
}

function countOf(data: unknown): number | undefined {
  return Array.isArray(data) ? data.length : undefined;
}

/**
 * Node's `fetch` throws a generic "fetch failed" and hides the real reason
 * (ECONNRESET, timeout, DNS, TLS…) in `err.cause`. Unwrap it so degraded feeds
 * report *why* they fell back — essential for diagnosing prod-only failures.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const causeMsg =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === "object" && "code" in cause
        ? String((cause as { code: unknown }).code)
        : cause
          ? String(cause)
          : "";
  return causeMsg ? `${err.message} (${causeMsg})` : err.message;
}

export async function runProvider<T>(
  def: ProviderDefinition<T>,
  opts: { cacheKey?: string } = {},
): Promise<ProviderResult<T>> {
  const cacheKey = opts.cacheKey ?? def.key;
  const started = Date.now();

  // Provider not configured: serve mock, clearly labelled OFFLINE.
  if (def.enabled === false) {
    const data = def.mock();
    log.warn("provider disabled", { provider: def.key, status: "offline", records: countOf(data) });
    return envelope(data, "mock", "offline", { cached: false, stale: true });
  }

  const entry = cache.get<T>(cacheKey);
  if (isFresh(entry)) {
    log.debug("provider cache fresh", { provider: def.key, cacheHit: true, records: countOf(entry!.value) });
    return envelope(entry!.value, def.key, "live", {
      cached: true,
      stale: false,
      fetchedAt: new Date(entry!.storedAt).toISOString(),
    });
  }

  try {
    const data = await def.fetch();
    cache.set(cacheKey, data, def.ttlMs);
    log.info("provider fetch ok", {
      provider: def.key,
      durationMs: Date.now() - started,
      status: "live",
      cacheHit: false,
      records: countOf(data),
    });
    return envelope(data, def.key, "live", { cached: false, stale: false });
  } catch (err) {
    const error = describeError(err);
    // Degrade to stale cache if we have any, else mock.
    if (entry) {
      log.warn("provider fetch failed, serving stale cache", {
        provider: def.key,
        durationMs: Date.now() - started,
        status: "cached",
        error,
      });
      return envelope(entry.value, def.key, "cached", {
        cached: true,
        stale: true,
        error,
        fetchedAt: new Date(entry.storedAt).toISOString(),
      });
    }
    const data = def.mock();
    log.error("provider fetch failed, serving mock", {
      provider: def.key,
      durationMs: Date.now() - started,
      status: "mock",
      error,
      records: countOf(data),
    });
    return envelope(data, "mock", "mock", { cached: false, stale: true, error });
  }
}

/** Trust ranking, best first. Used when merging multi-source results. */
const STATUS_RANK: DataStatus[] = ["live", "delayed", "cached", "mock", "offline"];

/**
 * Merge several array-valued provider results into one envelope. The combined
 * status is the *least trustworthy* contributor (a fused layer is only as live
 * as its weakest source), and rows are concatenated.
 */
export function mergeArrayResults<T>(
  results: ProviderResult<T[]>[],
  sourceLabel: string,
): ProviderResult<T[]> {
  const data = results.flatMap((r) => r.data);
  const worst = results.reduce<DataStatus>(
    (acc, r) => (STATUS_RANK.indexOf(r.status) > STATUS_RANK.indexOf(acc) ? r.status : acc),
    "live",
  );
  const errors = results.filter((r) => r.error).map((r) => `${r.source}: ${r.error}`);
  return {
    data,
    source: sourceLabel,
    status: worst,
    cached: results.some((r) => r.cached),
    stale: results.some((r) => r.stale),
    error: errors.length ? errors.join("; ") : undefined,
    fetchedAt: new Date().toISOString(),
    count: data.length,
  };
}

function envelope<T>(
  data: T,
  source: string,
  status: DataStatus,
  extra: { cached: boolean; stale: boolean; error?: string; fetchedAt?: string },
): ProviderResult<T> {
  return {
    data,
    source,
    status,
    cached: extra.cached,
    stale: extra.stale,
    error: extra.error,
    fetchedAt: extra.fetchedAt ?? new Date().toISOString(),
    count: countOf(data),
  };
}
