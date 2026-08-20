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

class MemoryCache implements CacheStore {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, storedAt: Date.now(), freshUntil: Date.now() + ttlMs });
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
export const cache: CacheStore = new MemoryCache();

export function isFresh(entry: CacheEntry<unknown> | undefined): boolean {
  return !!entry && entry.freshUntil > Date.now();
}
