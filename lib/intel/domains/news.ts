import { fetchGdeltNews } from "@/lib/providers/gdelt";
import { fetchEventRegistry, eventRegistryConfigured, type EnrichedArticle } from "../providers/eventregistry";
import { fetchNewsApi, newsApiConfigured } from "../providers/newsapi";
import { getDb } from "../db";
import { runIngestor, type IngestCounts, type IngestReport } from "../ingest";
import { upsertNews, upsertPerson, upsertOrganization } from "../repositories";
import { relate, linkArticleCountry } from "../enrich";
import { extractCountryMentions } from "../resolve";
import { clusterStories } from "../stories";
import type { VaultNews } from "../schemas";

/**
 * Multi-source news → canonical articles + entity graph + story clusters.
 *
 * Sources (each optional / degrades independently):
 *   - Event Registry — richest: articles WITH linked persons/orgs/locations
 *     (Wikipedia URIs) → populates the persons/organizations graph.
 *   - NewsAPI — breadth (labelled delayed/non-commercial).
 *   - GDELT — no key, global discovery.
 * Articles are deduped by canonical id (stable hash of URL). We store metadata
 * and links only — never full article bodies.
 */
export async function ingestNews(query?: string): Promise<IngestReport> {
  return runIngestor({ domain: "news", source: "eventregistry+newsapi+gdelt", job: "news-sync" }, async (c) => {
    const seen = new Set<string>();
    const articles: VaultNews[] = [];

    // 1) Event Registry (rich) — also builds the persons/orgs graph.
    if (eventRegistryConfigured()) {
      try {
        const enriched = await fetchEventRegistry({ keyword: query, count: 80 });
        for (const e of enriched) {
          if (seen.has(e.news.id)) continue;
          seen.add(e.news.id);
          articles.push(e.news);
          storeEntities(e, c);
        }
      } catch { c.failed++; }
    }

    // 2) NewsAPI (breadth).
    if (newsApiConfigured()) {
      try {
        for (const n of await fetchNewsApi({ query })) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          articles.push(n);
        }
      } catch { c.failed++; }
    }

    // 3) GDELT (no key). Map the app NewsItem shape onto VaultNews.
    try {
      for (const n of await fetchGdeltNews(query)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        articles.push({
          id: n.id, title: n.title, url: n.url, source: n.source, publisher: n.source,
          publishedAt: n.publishedAt, countryCode: n.countryCode,
          persons: n.people ?? [], organizations: n.organizations ?? [], themes: n.themes ?? [],
          provenance: [],
        });
      }
    } catch { c.failed++; }

    if (articles.length === 0) return;

    // Cluster into stories across the merged set.
    const assignment = clusterStories(articles.map((a) => a.title));
    const stories = new Map<string, { title: string; first: string; last: string; sources: Set<string>; count: number; countries: Set<string> }>();

    articles.forEach((a, i) => {
      c.fetched++;
      const storyId = assignment.get(i);
      const countries = new Set<string>();
      if (a.countryCode) countries.add(a.countryCode);
      for (const m of extractCountryMentions(a.title)) countries.add(m.iso2);
      upsertNews({ ...a, storyId });
      for (const iso2 of countries) linkArticleCountry(a.id, iso2);
      c.created++;

      if (storyId) {
        const s = stories.get(storyId) ?? { title: a.title, first: a.publishedAt, last: a.publishedAt, sources: new Set(), count: 0, countries: new Set() };
        s.count++;
        s.sources.add(a.source);
        if (a.publishedAt < s.first) s.first = a.publishedAt;
        if (a.publishedAt > s.last) s.last = a.publishedAt;
        for (const iso2 of countries) s.countries.add(iso2);
        stories.set(storyId, s);
      }
    });

    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO news_stories (id, title, first_seen, last_seen, article_count, countries, persons, organizations, source_diversity, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, first_seen=excluded.first_seen,
         last_seen=excluded.last_seen, article_count=excluded.article_count, countries=excluded.countries,
         source_diversity=excluded.source_diversity, updated_at=excluded.updated_at`,
    );
    const now = new Date().toISOString();
    for (const [id, s] of stories) {
      stmt.run(id, s.title, s.first, s.last, s.count, JSON.stringify([...s.countries]), "[]", "[]", s.sources.size, now);
    }
  });
}

/** Upsert persons/orgs from an enriched article + article MENTIONS edges. */
function storeEntities(e: EnrichedArticle, c: IngestCounts): void {
  for (const person of e.persons) {
    upsertPerson(person);
    relate(e.news.id, "MENTIONS", person.id, "entity-overlap", 0.8);
    c.updated++;
  }
  for (const org of e.organizations) {
    upsertOrganization(org);
    relate(e.news.id, "MENTIONS", org.id, "entity-overlap", 0.8);
  }
}
