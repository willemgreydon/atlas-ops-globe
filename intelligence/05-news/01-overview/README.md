# 05 · News Intelligence — Overview

**Status:** IMPLEMENTED (live ingestor; one source wired — live coverage may
degrade under GDELT rate limits).

## Mission

Discover global news at scale and turn a firehose of headlines into a
country-tagged, story-clustered, provenance-labelled corpus — **storing only
metadata and source links, never full article bodies** (GDELT terms +
copyright). News is the connective tissue of the vault: it geolocates activity,
surfaces emerging stories, and (once entity NER lands) will anchor persons and
organizations to the rest of the graph.

## At a glance

| Aspect | Value |
|---|---|
| Sources | `gdelt` (GDELT DOC 2.0) — IMPLEMENTED |
| Entities | NewsArticle, NewsStory, Country (via mention extraction) |
| Schema | `VaultNews` (`lib/intel/schemas.ts`) |
| Tables | `news_articles`, `news_stories`, `fts_news` |
| IDs | `IdOf.news(url)` (stable hash), `IdOf.story(key)` (stable hash) |
| Relationships | `article OCCURRED_IN country` (basis `reported`, conf 0.7) |
| CLI | `pnpm intel:sync news [--query "<q>"]` |
| API | `GET /api/intelligence/news?country=&since=` |
| Ingestor | `lib/intel/domains/news.ts` → `ingestNews()` |
| Provider | `lib/providers/gdelt.ts` → `fetchGdeltNews()` |
| Fetch cap | 50 records/query (`maxrecords=50`, `sort=DateDesc`) |

## Pipeline shape

`GDELT DOC 2.0 → fetchGdeltNews (Zod-validated) → clusterStories (headline
Jaccard ~0.5) → per-article country extraction (resolve.ts) → upsertNews +
news_stories + fts_news → linkArticleCountry (relationship)`.

## Key limitation

Person/organization NER is **NOT yet implemented (PLANNED)** — `persons[]` and
`organizations[]` are always empty and `news_stories.persons/organizations`
persist as `[]`. The `wikidata` source (CC0) is registered but disabled
(`status: next`); wiring it is the highest-value next step. See §07.

## Contents

- [02 · Sources](../02-sources/README.md) — GDELT dossier
- [03 · Entities](../03-entities/README.md) — NewsArticle, NewsStory, IDs
- [04 · Schemas](../04-schemas/README.md) — `VaultNews` field table + example
- [05 · Pipeline](../05-pipeline/README.md) — stages, CLI, tables, provenance
- [06 · Relationships](../06-relationships/README.md) — edges & basis
- [07 · Analysis & Gaps](../07-analysis-and-gaps/README.md) — metrics, SQL, gaps
