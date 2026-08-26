/**
 * Minimal in-memory TTL cache with stale-while-error semantics.
 *
 * This is the local/dev implementation of the caching interface. In production
 * the same `CacheStore` contract can be backed by Redis without touching call
 * sites (see docs/ARCHITECTURE.md §caching).
 */

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  /** Absolute epoch ms after which the entry is considered stale. */
  freshUntil: number;
}

export interface CacheStore {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
}

/**
 * Bounded LRU so per-query cache keys (e.g. `gdelt:${q}`, `worldbank:${iso}`)
 * cannot grow the map without limit — audit P2-1: an unbounded Map here was a
 * memory-exhaustion vector on the news/country routes. A `Map` preserves
 * insertion order, so the oldest key is always first; reading re-inserts a key
 * to mark it most-recently-used.
 */
const DEFAULT_MAX_ENTRIES = 500;

class MemoryCache implements CacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  constructor(private readonly maxEntries = DEFAULT_MAX_ENTRIES) {}

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (entry !== undefined) {
      // Mark as most-recently-used: delete + re-set moves it to the end.
      this.store.delete(key);
      this.store.set(key, entry);
    }
    return entry;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.delete(key);
    this.store.set(key, { value, storedAt: Date.now(), freshUntil: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Module-level singleton. In Next.js dev the module graph is re-evaluated on
 * change, which is fine for a cache. In production route handlers share one
 * instance per server process.
 */
export { MemoryCache };
export const cache: CacheStore = new MemoryCache();

export function isFresh(entry: CacheEntry<unknown> | undefined): boolean {
  return !!entry && entry.freshUntil > Date.now();
}
