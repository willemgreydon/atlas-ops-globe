import { z } from "zod";
import { fetchJson, hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { isValidPoint } from "@/lib/core/geo";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";

/**
 * UCDP (Uppsala Conflict Data Program) — geolocated organised-violence events.
 * https://ucdp.uu.se/apidocs/
 *
 * This is the densest free conflict record over the Sahel and Central Africa —
 * DR Congo, Sudan, Nigeria, CAR — exactly where the globe's conflict layer
 * looked empty (ACLED needs a myACLED login and 403s without it).
 *
 * As of 2025 the UCDP API requires a free access token (email the maintainers;
 * see docs/globe or the README). So this provider is GATED on UCDP_ACCESS_TOKEN
 * the same way FIRMS is gated on FIRMS_MAP_KEY: without the token it is a clean
 * no-op (enabled=false → OFFLINE, never fake data), and the conflict layer keeps
 * running on the ACLED vault baseline. Set the token and it lights up with no
 * further code.
 *
 * UCDP_DATASET overrides the dataset/version segment (default = a real GED
 * release verified to exist; point it at the latest monthly "candidate" release
 * for the freshest data — the version string changes over time, see UCDP docs).
 */
const DATASET = process.env.UCDP_DATASET ?? "gedevents/24.0.1";
const PAGE_SIZE = 1000;
const SINCE_DAYS = 365;
const RELIABILITY = 0.9;

const EventSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  latitude: z.union([z.string(), z.number()]).nullable().optional(),
  longitude: z.union([z.string(), z.number()]).nullable().optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  best: z.union([z.string(), z.number()]).nullable().optional(),
  deaths_civilians: z.union([z.string(), z.number()]).nullable().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  side_a: z.string().optional(),
  side_b: z.string().optional(),
  type_of_violence: z.union([z.string(), z.number()]).nullable().optional(),
});
const Schema = z.object({ Result: z.array(EventSchema).nullable().optional() });

export function ucdpConfigured(): boolean {
  return !!process.env.UCDP_ACCESS_TOKEN;
}

const num = (v: unknown): number => (v == null || v === "" ? NaN : Number(v));

/** Fatalities → severity band (a single deadly incident is already a warning). */
function severityForDeaths(best: number): Severity {
  if (best >= 100) return "critical";
  if (best >= 25) return "warning";
  if (best >= 1) return "watch";
  return "info";
}

const VIOLENCE: Record<string, string> = { "1": "state-based", "2": "non-state", "3": "one-sided" };

/** Map one UCDP GED event to a WorldEvent (pure — unit-testable). */
export function ucdpEventToWorld(e: z.infer<typeof EventSchema>): WorldEvent | null {
  const lat = num(e.latitude);
  const lon = num(e.longitude);
  const location = { lat, lon };
  if (!isValidPoint(location)) return null;
  const best = Math.max(0, num(e.best) || 0);
  const occurredAt = new Date(e.date_end ?? e.date_start ?? Date.now()).toISOString();
  const id = String(e.id ?? hashPayload(e));
  const violence = VIOLENCE[String(e.type_of_violence ?? "")] ?? "conflict";
  const sides = [e.side_a, e.side_b].filter(Boolean).join(" vs ");
  const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.75 }).score;
  return {
    id: `event:ucdp:${id}`,
    kind: "conflict",
    title: sides || `${violence} violence${e.country ? ` · ${e.country}` : ""}`,
    summary: `${best} fatalit${best === 1 ? "y" : "ies"} (best estimate) · ${violence}${e.country ? ` · ${e.country}` : ""}`,
    severity: severityForDeaths(best),
    occurredAt,
    location,
    source: "UCDP",
    sourceUrl: "https://ucdp.uu.se/",
    confidence,
    tags: ["conflict", violence, ...(e.country ? [e.country] : [])],
    provenance: makeProvenance({
      provider: "ucdp",
      providerRecordId: id,
      sourceUrl: "https://ucdp.uu.se/",
      observedAt: occurredAt,
      confidence,
      rawObjectHash: hashPayload(e),
    }),
  };
}

export async function fetchUcdpEvents(): Promise<WorldEvent[]> {
  const token = process.env.UCDP_ACCESS_TOKEN;
  if (!token) return [];
  const start = new Date(Date.now() - SINCE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const url = `https://ucdpapi.pcr.uu.se/api/${DATASET}?pagesize=${PAGE_SIZE}&page=1&StartDate=${start}`;
  const raw = await fetchJson<unknown>(url, {
    timeoutMs: 12_000,
    headers: { "x-ucdp-access-token": token },
  });
  const data = Schema.parse(raw);
  return (data.Result ?? []).flatMap((e) => {
    const w = ucdpEventToWorld(e);
    return w ? [w] : [];
  });
}

export const ucdpProvider: ProviderDefinition<WorldEvent[]> = {
  key: "ucdp",
  label: "UCDP Conflict Events",
  ttlMs: 6 * 3_600_000, // GED updates monthly; a 6h TTL is plenty and cheap
  reliability: RELIABILITY,
  enabled: ucdpConfigured(),
  fetch: fetchUcdpEvents,
  mock: () => [],
};
