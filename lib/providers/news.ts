import { hashPayload } from "@/lib/fetch-json";
import { makeProvenance } from "@/lib/core/provenance";
import { locateNews } from "@/lib/intel/resolve";
import { fetchGdeltNews } from "./gdelt";
import { fetchEventRegistry, eventRegistryConfigured } from "@/lib/intel/providers/eventregistry";
import { fetchNewsApi, newsApiConfigured } from "@/lib/intel/providers/newsapi";
import type { ProviderDefinition } from "@/lib/core/provider";
import type { NewsItem, GeoPoint } from "@/types/domain";
import type { VaultNews } from "@/lib/intel/schemas";
import { mockNews } from "@/lib/mock";

/**
 * Live multi-source news for the globe.
 *
 * The vault ingest (lib/intel/domains/news.ts) already fuses EventRegistry →
 * NewsAPI → GDELT, but that only runs in the offline CLI. This provider brings
 * the same fusion to the request path so `/api/news` serves real, geolocated
 * articles instead of falling back to GDELT-only (which rate-limits hard and
 * degrades to mock). Each source degrades independently; GDELT (no key) is the
 * always-available floor.
 */
const DEFAULT_QUERY = "conflict OR diplomacy OR sanctions OR disaster";

/** Anchors a supplementary GDELT pass on the under-covered regions so their
 *  stories surface and geolocate (country + hub cities in the gazetteer). */
const REGION_QUERY =
  "Russia OR China OR Nigeria OR Ethiopia OR Kenya OR Congo OR Sudan OR Egypt OR Beijing OR Shanghai OR Moscow OR Lagos OR Nairobi OR Johannesburg";

/** Map a vault article onto the globe `NewsItem` shape, geolocating for plot. */
function vaultToNews(a: VaultNews, provider: string): NewsItem {
  const explicit: GeoPoint | undefined =
    a.lat != null && a.lon != null ? { lat: a.lat, lon: a.lon } : undefined;
  const country = explicit ? null : locateNews(a.title, a.countryCode);
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    source: a.publisher ?? a.source,
    publishedAt: a.publishedAt,
    countryCode: a.countryCode ?? country?.iso2,
    people: a.persons,
    organizations: a.organizations,
    themes: a.themes,
    location: explicit ?? country?.point,
    provenance: makeProvenance({
      provider,
      providerRecordId: a.id,
      sourceUrl: a.url ?? "",
      observedAt: a.publishedAt,
      rawObjectHash: hashPayload(a),
    }),
  };
}

export async function fetchLiveNews(query = DEFAULT_QUERY): Promise<NewsItem[]> {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  let failures = 0;
  let attempts = 0;

  const merge = (items: NewsItem[]) => {
    for (const n of items) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
  };

  // 1) Event Registry — richest (linked persons/orgs, source country).
  if (eventRegistryConfigured()) {
    attempts++;
    try {
      const enriched = await fetchEventRegistry({ keyword: query, count: 80 });
      merge(enriched.map((e) => vaultToNews(e.news, "eventregistry")));
    } catch {
      failures++;
    }
  }

  // 2) NewsAPI — breadth.
  if (newsApiConfigured()) {
    attempts++;
    try {
      merge((await fetchNewsApi({ query })).map((n) => vaultToNews(n, "newsapi")));
    } catch {
      failures++;
    }
  }

  // 3) GDELT — no key, global discovery floor.
  attempts++;
  try {
    merge(await fetchGdeltNews(query));
  } catch {
    failures++;
  }

  // 4) Region-targeted GDELT — the default/EventRegistry mix skews Western, so
  //    Russia/China/Africa stories get crowded out. In default-browse mode only
  //    (never when the user is searching), pull an extra pass anchored on those
  //    regions so they surface and geolocate via the city gazetteer. Best-effort:
  //    a second GDELT call may rate-limit, which just adds nothing that round.
  if (query === DEFAULT_QUERY) {
    attempts++;
    try {
      merge(await fetchGdeltNews(REGION_QUERY));
    } catch {
      failures++;
    }
  }

  // Every source we tried failed → surface an error so runProvider serves the
  // last good cache (or, cold, honest mock) rather than an empty "live" feed.
  if (out.length === 0 && failures === attempts) {
    throw new Error("all news sources failed");
  }

  return out
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 120);
}

export function liveNewsProvider(query = DEFAULT_QUERY): ProviderDefinition<NewsItem[]> {
  return {
    key: "news",
    label: "News (EventRegistry · NewsAPI · GDELT)",
    ttlMs: 120_000,
    reliability: 0.75,
    fetch: () => fetchLiveNews(query),
    mock: () => mockNews(),
  };
}
