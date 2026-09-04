import { NextResponse } from "next/server";
import type { FreshnessDomain } from "@/lib/intel/freshness";

/**
 * Vault reads go through the Turso embedded replica. If a read throws — the
 * free-tier read quota is exhausted, or a cold replica hasn't pulled yet — the
 * route must NOT 500. It degrades to a 200 with an empty, honestly-flagged body
 * so secondary layers render empty (and the console stays clean) instead of
 * erroring. Live-at-request feeds (aircraft/markets/weather/news/events) are
 * unaffected; this only guards the vault-backed routes.
 */
/**
 * Log the real error server-side and return a generic, non-leaking string for
 * the client. Raw error messages exposed infrastructure detail (e.g. "Turso read
 * quota blocked", cold-replica state, DB internals) — useful for an attacker
 * profiling the deployment, useless to a legitimate user (the `degraded`/`status`
 * flags already convey the state). Keep the detail in the server logs.
 */
export function scrubError(e: unknown, context: string): string {
  console.error(`[${context}]`, e instanceof Error ? (e.stack ?? e.message) : e);
  return "temporarily unavailable";
}

export function safeVault(build: () => unknown, fallback: Record<string, unknown>): NextResponse {
  try {
    return NextResponse.json(build());
  } catch (e) {
    return NextResponse.json({ ...fallback, degraded: true, error: scrubError(e, "vault-read") });
  }
}

const EMPTY_PAGE = { limit: 0, offset: 0, count: 0, nextOffset: null } as const;

/** Empty `{ data, page }` body, optionally with an unknown-freshness envelope. */
export function emptyPage(extra: Record<string, unknown> = {}, domain?: FreshnessDomain): Record<string, unknown> {
  const base: Record<string, unknown> = { data: [], page: EMPTY_PAGE, ...extra };
  if (domain) base.freshness = { domain, state: "unknown", latestObservedAt: null, ageMs: null };
  return base;
}
