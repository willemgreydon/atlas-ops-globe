import { fetchGdeltNews } from "@/lib/providers/gdelt";
import { prov } from "@/lib/intel/provenance";
import { getDb } from "../db";
import { runIngestor, type IngestReport } from "../ingest";
import { upsertNews } from "../repositories";
import { linkArticleCountry } from "../enrich";
import { resolveCountry, extractCountryMentions } from "../resolve";
import { clusterStories } from "../stories";
import type { VaultNews } from "../schemas";

/**
 * GDELT news → canonical articles + light entity extraction (country mentions)
 * + heuristic story clustering. We store metadata and source links only, never
 * full article bodies (GDELT terms + copyright). Person/org NER is future work
 * (Wikidata adapter is registered but not wired).
 */
export async function ingestNews(query?: string): Promise<IngestReport> {
  return runIngestor({ domain: "news", source: "gdelt", job: "news-sync" }, async (c) => {
    const articles = await fetchGdeltNews(query);
    if (articles.length === 0) return;

    const assignment = clusterStories(articles.map((a) => a.title));
    const now = new Date().toISOString();

    // Aggregate story metadata as we go.
    const stories = new Map<string, { title: string; first: string; last: string; sources: Set<string>; count: number; countries: Set<string> }>();

    articles.forEach((a, i) => {
      c.fetched++;
      const storyId = assignment.get(i);
      const sourceCountry = resolveCountry(a.countryCode ?? undefined);
      const mentions = extractCountryMentions(a.title);
      const countries = new Set<string>();
      if (sourceCountry) countries.add(sourceCountry.iso2);
      for (const m of mentions) countries.add(m.iso2);

      const record: VaultNews = {
        id: a.id,
        title: a.title,
        url: a.url,
        source: a.source,
        publisher: a.source,
        publishedAt: a.publishedAt,
        countryCode: sourceCountry?.iso2 ?? [...countries][0],
        persons: [],
        organizations: [],
        themes: [],
        storyId,
        provenance: [
          prov({
            provider: "gdelt",
            providerRecordId: a.url,
            sourceUrl: a.url,
            publishedAt: a.publishedAt,
            license: "GDELT terms; metadata/link only",
            attribution: "The GDELT Project",
          }),
        ],
      };
      upsertNews(record);
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

    // Persist story clusters.
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO news_stories (id, title, first_seen, last_seen, article_count, countries, persons, organizations, source_diversity, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, first_seen=excluded.first_seen,
         last_seen=excluded.last_seen, article_count=excluded.article_count, countries=excluded.countries,
         source_diversity=excluded.source_diversity, updated_at=excluded.updated_at`,
    );
    for (const [id, s] of stories) {
      stmt.run(id, s.title, s.first, s.last, s.count, JSON.stringify([...s.countries]), "[]", "[]", s.sources.size, now);
    }
  });
}
