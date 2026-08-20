# news

**Status: Implemented (live coverage may degrade)**

## Purpose
Global news awareness from metadata: article links, country-mention extraction,
and heuristic story clustering. Metadata and source links only — never full
article bodies.

## Current sources
- **GDELT DOC 2.0** (`gdelt`) — global article stream. Ingestor implemented
  (articles + country entity extraction + heuristic story clustering).

## Canonical entities
- `NewsArticle`, `NewsStory` (see `VaultNews`). `persons`/`organizations`
  arrays exist but are empty pending NER.

## Update frequency
- Polling. min interval 6s, concurrency 1, cache TTL 120s. Last in the
  bootstrap/update order (rate-limited).

## Storage
- `news_articles`, `news_stories`; FTS5 `fts_news`; country links in
  `relationships`; `provenance` rows. IDs via `IdOf.news(url)` / `IdOf.story()`.

## Known limitations
- **GDELT rate-limits aggressively** (~1 req/5s, plain text on rejection) so
  live runs may degrade; logic is proven by fixture-independent tests.
- No person/org NER — Wikidata adapter registered but not wired, so
  `persons`/`organizations` are empty.
- Story clustering is title-heuristic, not semantic.

## Licensing considerations
- GDELT terms; links/metadata only — commercial use review-required,
  redistribution **restricted**; attribution required ("The GDELT Project").
  Do not store full article bodies.

## Next sources
- **Wikidata** (`wikidata`, `next`) for person/organization enrichment.
