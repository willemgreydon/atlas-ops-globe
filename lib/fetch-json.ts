import type { ZodType } from "zod";
import { fnv1a } from "@/lib/core/id";

const DEFAULT_UA = "atlas-ops-globe/0.1 (+https://github.com/atlas-ops-globe)";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Fetch JSON with a hard timeout and a descriptive User-Agent. Throws on
 * non-2xx or timeout — callers wrap this in the provider framework, which turns
 * failures into graceful degradation.
 */
export async function fetchJson<T>(url: string, init: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 9000, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { "user-agent": DEFAULT_UA, accept: "application/json", ...headers },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${hostOf(url)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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
