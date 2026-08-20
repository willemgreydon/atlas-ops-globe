# 05 · News — Analysis & Gaps

## Derived metrics (IMPLEMENTED)

- **Story clustering** — headline-token Jaccard (~0.5) groups reports of the
  same event (`lib/intel/stories.ts`). Explainable and deterministic.
- **Source diversity** — `news_stories.source_diversity` = count of distinct
  publishers in a cluster. A proxy for corroboration; the vault tracks lineage
  rather than asserting consensus.
- **Country tagging** — per-article ISO2 tags from metadata + headline NER.
- **Freshness** — `first_seen` / `last_seen` on stories; `published_at` on
  articles.

## Example SQL

Top stories by breadth of coverage:

```sql
SELECT title, article_count, source_diversity, first_seen, last_seen
FROM news_stories
ORDER BY source_diversity DESC, article_count DESC
LIMIT 20;
```

Article volume by country in the last day:

```sql
SELECT country_code, COUNT(*) AS n
FROM news_articles
WHERE published_at >= datetime('now','-1 day')
GROUP BY country_code ORDER BY n DESC;
```

Full-text search (FTS5):

```sql
SELECT id, title FROM fts_news WHERE fts_news MATCH 'sanctions*' LIMIT 25;
```
(via `fullTextSearch("fts_news", q)` in `lib/intel/queries.ts`.)

## Example API queries

```
GET /api/intelligence/news?country=UA&since=24h&limit=100
GET /api/intelligence/news?since=7d
```
`since` accepts `Nm|Nh|Nd` (`parseSince`); `limit` clamps to 1–500; response is
paginated (`nextOffset`) and carries `attribution: "The GDELT Project"`.
Country profiles surface the latest 10 headlines per country at
`GET /api/intelligence/countries/[code]` (`current.news`).

## Gaps & limitations

| Gap | Impact | Status |
|---|---|---|
| No person/org NER | `persons[]`/`orgs[]` empty; no MENTIONS/INVOLVES edges | PLANNED (`wikidata`) |
| Single source | GDELT-only; no direct RSS/wire feeds | — |
| Title-only clustering | misses semantic dupes; over-splits reworded headlines | heuristic by design |
| GDELT rate limits | ~1 req/5s; plain-text rejection; 50 records/query | mitigated (pacing, last in order) |
| No bodies stored | can't do sentiment/entity extraction on full text | intentional (licensing) |
| `themes[]` unused | GDELT GKG themes not ingested | future |
| No TTL/retention | records persist until overwritten | — |

## Data quality notes

- Country tags are `reported`-basis (conf 0.70) — treat as topical association,
  not precise geolocation.
- `source_diversity` counts publisher hosts, which can inflate for syndicated
  wire copy sharing a domain — read alongside `article_count`.
- Idempotent URL-hash IDs prevent duplicate inflation across re-syncs.

## Highest-value next step

Wire **Wikidata** (CC0, free) for person/organization NER to populate the empty
arrays and unlock `MENTIONS`/`INVOLVES` edges — the single biggest lift for this
domain's graph value.
