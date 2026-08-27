/**
 * In-memory TTL cache for live-at-request API routes.
 *
 * Some time-sensitive domains have free providers reachable directly from
 * Vercel (Finnhub markets, Open-Meteo weather) — unlike OpenSky, which blocks
 * datacenter egress. For those we skip the vault entirely and fetch live in the
 * route, so the data is always as fresh as the provider allows, with no sync lag
 * and no embedded-replica cold-start staleness.
 *
 * This cache coalesces the upstream call across the seconds-apart client polls
 * of a single warm function instance, keeping us well within provider rate
 * limits. It is per-instance (module state); a handful of cold instances simply
 * refetch — still trivial traffic. On a transient upstream failure we serve the
 * last good value (with its real, now-older timestamp, so freshness stays
 * honest) instead of flapping the feed to OFFLINE.
 */

type Inflight<T> = { at: number; value: Promise<T> };

const inflight = new Map<string, Inflight<unknown>>();
const lastGood = new Map<string, unknown>();

export function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = inflight.get(key) as Inflight<T> | undefined;
  if (hit && now - hit.at < ttlMs) return hit.value;

  const entry: Inflight<T> = { at: now, value: undefined as unknown as Promise<T> };
  entry.value = fn()
    .then((v) => {
      lastGood.set(key, v);
      return v;
    })
    .catch((e) => {
      // Let the next poll retry immediately, and fall back to the last good
      // value if we have one so a blip doesn't blank the feed.
      if (inflight.get(key) === entry) inflight.delete(key);
      if (lastGood.has(key)) return lastGood.get(key) as T;
      throw e;
    });
  inflight.set(key, entry as Inflight<unknown>);
  return entry.value;
}

/** Test hook: clear all cached state. */
export function __clearLiveCache(): void {
  inflight.clear();
  lastGood.clear();
}
