# 05 · News — Pipeline

Entry point: `ingestNews(query?)` in `lib/intel/domains/news.ts`, wrapped by
`runIngestor({ domain: "news", source: "gdelt", job: "news-sync" }, …)` which
handles timing, counters, logging and failure isolation.

## Stages

1. **Fetch** — `fetchGdeltNews(query)` (`lib/providers/gdelt.ts`). Builds the
   DOC 2.0 URL (`mode=ArtList`, `maxrecords=50`, `format=json`,
   `sort=DateDesc`), reads body as **text**, detects plain-text rejection, then
   Zod-parses. Returns up to 50 `NewsItem`s. Empty result → early return.
2. **Cluster** — `clusterStories(titles)` (`lib/intel/stories.ts`) assigns each
   article to a story via headline-token Jaccard (threshold ~0.5, stopwords
   removed). Returns `Map<index, storyId>`.
3. **Resolve country** — per article, `resolveCountry(sourcecountry)` +
   `extractCountryMentions(title)` (`lib/intel/resolve.ts`). Countries de-duped
   into a set; `countryCode` = source country, else first mention.
4. **Persist article** — build `VaultNews`, `upsertNews()` →
   `news_articles` + `fts_news` + `provenance`. `c.fetched++`, `c.created++`.
5. **Link country** — `linkArticleCountry(id, iso2)` for every resolved country
   → `relationships` (see §06).
6. **Aggregate story** — accumulate per-story `title`, `first/last` seen,
   `count`, `sources` set (diversity), `countries` set.
7. **Persist stories** — batch upsert into `news_stories` (`persons`/`orgs`
   stored as `"[]"`).

## CLI

| Command | Effect |
|---|---|
| `pnpm intel:sync news` | one sync, default query |
| `pnpm intel:sync news --query "election OR coup"` | custom GDELT query |
| `pnpm intel:sync --all` | includes news (runs last) |
| `pnpm intel:bootstrap` / `intel:update` | news is **last** in both orders (rate-limited) |
| `pnpm intel:status` / `intel:stats` | shows News Articles / News Stories counts |

## Cadence & TTL

Polling source. `minIntervalSec: 6`, `concurrency: 1`, `cacheTtlSec: 120`.
Placed last in `BOOTSTRAP_ORDER` / `UPDATE_ORDER` (`lib/intel/registry.ts`) so
GDELT's rate limit never blocks cheaper domains.

## Tables & columns

- **`news_articles`** — `id, title, url, source, publisher, published_at,
  language, country_code, lat, lon, persons, organizations, themes, story_id,
  provenance, fetched_at`. Indexes: `published_at`, `country_code`, `story_id`.
- **`news_stories`** — `id, title, first_seen, last_seen, article_count,
  countries, persons, organizations, source_diversity, updated_at`.
- **`fts_news`** — FTS5 (`id UNINDEXED, title, body`).
- **`relationships`**, **`provenance`** — shared.

## Provenance & retention

Every article writes one `provenance` row (provider, url, license, attribution,
`retrievedAt`, transformation). **No article bodies are ever stored** — GDELT
terms + copyright. Upserts are idempotent on the URL-hash id; there is no TTL
eviction — records persist until overwritten. Live coverage may degrade under
GDELT rate limits without failing the job (job is PARTIAL only if `failed > 0`).
