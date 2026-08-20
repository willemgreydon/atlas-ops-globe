/**
 * Bounded-concurrency utilities for responsible acquisition. Never fire
 * `Promise.all` over thousands of requests — cap concurrency and pace calls.
 */

/** Run `worker` over `items` with at most `concurrency` in flight. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Minimal token-interval limiter: guarantees at least `minIntervalMs` between
 * successive `wait()` resolutions for a given key.
 */
export class RateLimiter {
  private last = new Map<string, number>();
  async wait(key: string, minIntervalMs: number): Promise<void> {
    const prev = this.last.get(key) ?? 0;
    const wait = prev + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.last.set(key, Date.now());
  }
}

export const limiter = new RateLimiter();

/** Exponential backoff retry with jitter-free deterministic delays. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs?: number } = { retries: 3 },
): Promise<T> {
  const base = opts.baseMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < opts.retries) await sleep(base * 2 ** attempt);
    }
  }
  throw lastErr;
}
