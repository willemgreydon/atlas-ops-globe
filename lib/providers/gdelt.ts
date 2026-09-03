import { z } from "zod";
import { hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { stableId } from "@/lib/core/id";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { NewsItem } from "@/types/domain";
import { mockNews } from "@/lib/mock";
import { locateNews } from "@/lib/intel/resolve";

/**
 * GDELT DOC 2.0 — global news article discovery.
 * https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */
const Schema = z.object({
  articles: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        seendate: z.string(),
        domain: z.string(),
        language: z.string().optional(),
        sourcecountry: z.string().optional(),
      }),
    )
    .optional(),
});

const DEFAULT_QUERY = "conflict OR diplomacy OR sanctions OR disaster";

/**
 * GDELT DOC 2.0 now *requires* OR'd terms to be wrapped in parentheses — a bare
 * `a OR b` returns a plain-text rejection ("Queries containing OR'd terms must
 * be surrounded by ()"), which our text-guard turns into an error and an empty
 * feed. We wrap defensively here, at the GDELT boundary only, because the same
 * query strings are shared with NewsAPI / EventRegistry (different syntax) and
 * must not be mutated at the source. Idempotent for already-parenthesised or
 * single-term queries.
 */
export function gdeltParenQuery(q: string): string {
  const t = q.trim();
  if (!/ OR /i.test(t)) return t;
  if (t.startsWith("(") && t.endsWith(")")) return t;
  return `(${t})`;
}

/** GDELT seendate is `YYYYMMDDTHHMMSSZ`; normalize to ISO-8601. */
export function parseSeenDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

export async function fetchGdeltNews(query = DEFAULT_QUERY): Promise<NewsItem[]> {
  const qs = new URLSearchParams({
    query: gdeltParenQuery(query),
    mode: "ArtList",
    maxrecords: "50",
    format: "json",
    sort: "DateDesc",
  });
  // GDELT returns HTTP 200 with a *plain-text* body when rate-limiting or
  // rejecting a query, so we read text first and detect that before parsing.
  const raw = await fetchGdeltText(`https://api.gdeltproject.org/api/v2/doc/doc?${qs}`);
  return normalizeGdelt(raw);
}

/**
 * Pure GDELT payload → `NewsItem[]`. Extracted from the fetch so the mapping —
 * especially the geolocation that puts world news on the globe — is unit-tested
 * without a network round-trip.
 */
export function normalizeGdelt(raw: unknown): NewsItem[] {
  const data = Schema.parse(raw);
  return (data.articles ?? []).map((a) => {
    const publishedAt = parseSeenDate(a.seendate);
    // Geolocate for the globe: the country the story is *about* (from the
    // headline), else the article's source country. GDELT gives no coordinates,
    // so without this world news never plots on the globe.
    const country = locateNews(a.title, a.sourcecountry);
    return {
      id: stableId("news", a.url),
      title: a.title,
      url: a.url,
      source: a.domain,
      publishedAt,
      countryCode: country?.iso2 ?? a.sourcecountry,
      location: country?.point,
      provenance: makeProvenance({
        provider: "gdelt",
        providerRecordId: a.url,
        sourceUrl: a.url,
        observedAt: publishedAt,
        rawObjectHash: hashPayload(a),
      }),
    } satisfies NewsItem;
  });
}

/**
 * Fetch a GDELT API URL, tolerating its quirk of returning HTTP 200 with a
 * plain-text body when it rate-limits or rejects a query. Shared by the news and
 * conflict providers.
 */
export async function fetchGdeltText(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      // GDELT resets the connection (ECONNRESET) for bare tool user-agents; a
      // browser-like UA is required to get a response at all. Keep the product
      // token in the comment segment for honest attribution.
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; atlas-ops-globe/0.1; +https://github.com/atlas-ops-globe)",
        accept: "application/json",
      },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    const text = await res.text();
    const trimmed = text.trimStart();
    if (!res.ok) throw new Error(`gdelt ${res.status}`);
    // Rate-limit / query-rejection responses are plain text, not JSON.
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      throw new Error(`gdelt rejected request: ${trimmed.slice(0, 80)}`);
    }
    return JSON.parse(trimmed);
  } finally {
    clearTimeout(timer);
  }
}

export function gdeltProvider(query = DEFAULT_QUERY): ProviderDefinition<NewsItem[]> {
  return {
    key: "gdelt",
    label: "GDELT DOC 2.0 News",
    ttlMs: 120_000,
    reliability: 0.7,
    fetch: () => fetchGdeltNews(query),
    mock: () => mockNews(),
  };
}
