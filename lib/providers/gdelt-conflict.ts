import { z } from "zod";
import { hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { scoreConfidence } from "@/lib/core/confidence";
import { stableId } from "@/lib/core/id";
import { locateNews } from "@/lib/intel/resolve";
import { fetchGdeltText, parseSeenDate, gdeltParenQuery } from "@/lib/providers/gdelt";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { Severity, WorldEvent } from "@/types/domain";

/**
 * GDELT DOC 2.0 — conflict events, the keyless alternative to UCDP/ACLED.
 * https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 *
 * ACLED needs a myACLED login and UCDP now needs a token; GDELT is the one
 * conflict-capable source that stays keyless AND is reachable from Vercel (the
 * news layer already runs on it). We query conflict-themed reporting, geolocate
 * each report with the same city gazetteer the news layer uses (`locateNews` —
 * city-precise when the headline names one, else the country it's about), and
 * map to conflict `WorldEvent`s. Dense globally, including the Central African /
 * Sahel belt (DRC, Sudan, Nigeria, CAR) the globe looked empty over.
 *
 * HONEST CAVEAT: this is *media-derived* — a point is "a news report mentioning
 * conflict near place X", not a curated, fatality-verified record like UCDP/
 * ACLED. It is noisier and coarser. It runs as a keyless baseline; when a UCDP
 * token is present, that curated feed merges on top in the conflict route.
 */
const Schema = z.object({
  articles: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        seendate: z.string(),
        domain: z.string(),
        sourcecountry: z.string().optional(),
      }),
    )
    .optional(),
});

// Conflict-focused query: a handful of simple single-word OR terms, no quoted
// phrases (GDELT DOC rejects over-complex queries with a plain-text error). The
// OR terms are parenthesised at the fetch layer via gdeltParenQuery — GDELT now
// requires that wrapping or it rejects the request.
const DEFAULT_QUERY = "airstrike OR clashes OR militants OR insurgents OR shelling OR fighting";
/** Complementary conflict passes → denser global coverage (incl. the Sahel /
 *  Central-Africa belt UCDP/ACLED cover but the single query can miss). Each is
 *  simple single-word ORs (GDELT rejects complex queries); parenthesised at the
 *  fetch layer. Deduped by event id downstream. */
export const CONFLICT_QUERIES = [
  "airstrike OR clashes OR militants OR insurgents OR shelling OR fighting",
  "war OR gunmen OR rebels OR troops OR offensive OR siege",
  "attack OR ambush OR bombing OR raid OR gunfire OR casualties",
];
const RELIABILITY = 0.55; // media-derived — deliberately lower than UCDP/ACLED

// Intensity words in the headline → severity band (best-effort, no fatality data).
const CRITICAL = /massacre|dozens killed|mass killing|genocide|slaughter/i;
const WARNING = /killed|dead|airstrike|bombing|massac|offensive|shelling|deadly|casualt/i;

function severityFor(title: string): Severity {
  if (CRITICAL.test(title)) return "critical";
  if (WARNING.test(title)) return "warning";
  return "watch";
}

/**
 * Pure GDELT payload → conflict `WorldEvent[]`. Extracted from the fetch so the
 * mapping — geolocation + severity — is unit-tested without a network call. Only
 * reports that geolocate are kept (a conflict point needs a position).
 */
export function normalizeGdeltConflict(raw: unknown): WorldEvent[] {
  const data = Schema.parse(raw);
  const out: WorldEvent[] = [];
  const seen = new Set<string>();
  for (const a of data.articles ?? []) {
    const loc = locateNews(a.title, a.sourcecountry);
    if (!loc) continue; // no position → can't plot
    // Collapse repeat reporting of the same incident: one point per place + lead
    // headline word so a hot story isn't 30 stacked dots.
    const key = `${loc.point.lat.toFixed(1)},${loc.point.lon.toFixed(1)}|${a.title.slice(0, 24).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const occurredAt = parseSeenDate(a.seendate);
    const confidence = scoreConfidence({ sourceCount: 1, providerReliability: RELIABILITY, geoPrecision: 0.6 }).score;
    out.push({
      id: `event:gdelt-conflict:${stableId("conflict", a.url)}`,
      kind: "conflict",
      title: a.title,
      summary: `${a.domain} · ${loc.name}`,
      severity: severityFor(a.title),
      occurredAt,
      location: loc.point,
      countryCode: loc.iso2,
      source: "GDELT",
      sourceUrl: a.url,
      confidence,
      tags: ["conflict", "gdelt", loc.name],
      provenance: makeProvenance({
        provider: "gdelt-conflict",
        providerRecordId: a.url,
        sourceUrl: a.url,
        observedAt: occurredAt,
        confidence,
        rawObjectHash: hashPayload(a),
      }),
    });
  }
  return out;
}

export async function fetchGdeltConflict(query = DEFAULT_QUERY, maxrecords = 75): Promise<WorldEvent[]> {
  const qs = new URLSearchParams({
    query: gdeltParenQuery(query),
    mode: "ArtList",
    maxrecords: String(Math.min(250, Math.max(1, maxrecords))), // GDELT caps ArtList at 250
    format: "json",
    sort: "DateDesc",
  });
  const raw = await fetchGdeltText(`https://api.gdeltproject.org/api/v2/doc/doc?${qs}`);
  return normalizeGdeltConflict(raw);
}

export const gdeltConflictProvider: ProviderDefinition<WorldEvent[]> = {
  key: "gdelt-conflict",
  label: "GDELT Conflict Events",
  ttlMs: 15 * 60_000,
  reliability: RELIABILITY,
  fetch: () => fetchGdeltConflict(),
  mock: () => [],
};
