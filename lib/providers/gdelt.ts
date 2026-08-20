import { z } from "zod";
import { hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { stableId } from "@/lib/core/id";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { NewsItem } from "@/types/domain";
import { mockNews } from "@/lib/mock";

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

/** GDELT seendate is `YYYYMMDDTHHMMSSZ`; normalize to ISO-8601. */
function parseSeenDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

export async function fetchGdeltNews(query = DEFAULT_QUERY): Promise<NewsItem[]> {
  const qs = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: "50",
    format: "json",
    sort: "DateDesc",
  });
  // GDELT returns HTTP 200 with a *plain-text* body when rate-limiting or
  // rejecting a query, so we read text first and detect that before parsing.
  const raw = await fetchGdeltText(`https://api.gdeltproject.org/api/v2/doc/doc?${qs}`);
  const data = Schema.parse(raw);

  return (data.articles ?? []).map((a) => {
    const publishedAt = parseSeenDate(a.seendate);
    return {
      id: stableId("news", a.url),
      title: a.title,
      url: a.url,
      source: a.domain,
      publishedAt,
      countryCode: a.sourcecountry,
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

async function fetchGdeltText(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "atlas-ops-globe/0.1", accept: "application/json" },
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
