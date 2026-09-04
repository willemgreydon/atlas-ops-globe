import type { ZodType } from "zod";
import { fnv1a } from "@/lib/core/id";

const DEFAULT_UA = "atlas-ops-globe/0.1 (+https://github.com/atlas-ops-globe)";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  /** Extra attempts on a transient failure (network/timeout or 5xx). Default 0. */
  retries?: number;
  /** Exponential-backoff base between retries (ms). Default 300. */
  retryBaseMs?: number;
}

/** HTTP error carrying the status so the retry policy can tell transient (5xx) from permanent (4xx). */
export class HttpError extends Error {
  constructor(public readonly status: number, host: string, statusText: string) {
    super(`${status} ${statusText} for ${host}`);
    this.name = "HttpError";
  }
}

/**
 * One fetch attempt with a hard timeout and descriptive UA; throws HttpError on
 * non-2xx. Shared by fetchJson/fetchText — the body read stays inside the timeout
 * so a slow-streaming body (e.g. a large CSV) is also bounded. Retries (opt-in)
 * re-run the whole attempt: transient failures (network, timeout, 5xx) back off
 * and retry; permanent ones (4xx) throw immediately. Default retries=0 keeps the
 * long-standing throw-on-first-failure behaviour for callers that don't opt in.
 */
async function request<T>(url: string, init: FetchOptions, accept: string, read: (r: Response) => Promise<T>): Promise<T> {
  const { timeoutMs = 9000, retries = 0, retryBaseMs = 300, headers, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { "user-agent": DEFAULT_UA, accept, ...headers },
        signal: ctrl.signal,
        next: { revalidate: 0 },
      });
      if (!res.ok) throw new HttpError(res.status, hostOf(url), res.statusText);
      return await read(res);
    } catch (e) {
      lastErr = e;
      const permanent = e instanceof HttpError && e.status < 500; // 4xx won't fix on retry
      if (permanent || attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, retryBaseMs * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr; // unreachable — the loop either returns or throws
}

/**
 * Fetch JSON with a hard timeout and a descriptive User-Agent. Throws on
 * non-2xx or timeout — callers wrap this in the provider framework, which turns
 * failures into graceful degradation. Pass `retries` for transient resilience.
 */
export function fetchJson<T>(url: string, init: FetchOptions = {}): Promise<T> {
  return request<T>(url, init, "application/json", (r) => r.json() as Promise<T>);
}

/** Fetch a plain-text body (e.g. a CSV feed) with the same timeout/UA/retry policy. */
export function fetchText(url: string, init: FetchOptions = {}): Promise<string> {
  return request<string>(url, init, "text/csv, text/plain, */*", (r) => r.text());
}

/**
 * Fetch JSON and validate it at the trust boundary with a Zod schema. External
 * data is never assumed to match our types — this is where we enforce it.
 */
export async function fetchValidated<T>(
  url: string,
  schema: ZodType<T>,
  init?: FetchOptions,
): Promise<T> {
  const raw = await fetchJson<unknown>(url, init);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`schema validation failed for ${hostOf(url)}: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

/** Stable content hash of a raw provider payload, for provenance. */
export function hashPayload(value: unknown): string {
  return fnv1a(typeof value === "string" ? value : JSON.stringify(value));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
