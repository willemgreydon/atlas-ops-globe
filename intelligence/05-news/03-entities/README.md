# 05 · News — Entities

News touches four ontology entity types (`lib/intel/ontology.ts`). Two are
materialized as domain tables; Country is reused from the geography layer.

## Entity types

| Ontology type | Materialized? | Store | Notes |
|---|---|---|---|
| `NewsArticle` | Yes | `news_articles` | one row per article URL |
| `NewsStory` | Yes | `news_stories` | cluster of related articles |
| `Country` | Reused | `countries` / `entities` | via mention extraction |
| `Person`, `Organization` | PLANNED | `persons`, `organizations` | empty pending NER |

## Universal identity (`lib/intel/ids.ts`)

Provider IDs are never the primary identity. News entities mint stable internal
IDs:

| Entity | ID form | Function | Example |
|---|---|---|---|
| Article | `stableId("news", url)` | `IdOf.news(url)` | `news:9f2c…` |
| Story | `stableId("story", key)` | `IdOf.story(key)` | `story:1a7b…` |
| Country | `country:<ISO2>` | `IdOf.country(iso2)` | `country:UA` |
| Person | `person:<QID>` or hash | `IdOf.person()` | PLANNED |
| Org | `org:<QID>`/`org:LEI-…`/hash | `IdOf.org()` | PLANNED |

The article ID is a **stable hash of the URL**, so re-ingesting the same article
upserts (idempotent). The story key is `"<title>#<index>"` of the cluster seed,
hashed to `IdOf.story`.

## NewsArticle fields

`id`, `title`, `url`, `source` (GDELT `domain`), `publisher`, `publishedAt`,
`language`, `countryCode`, `lat`/`lon` (unused for GDELT), `persons[]`,
`organizations[]`, `themes[]`, `storyId`, `provenance[]`.

## NewsStory fields (`news_stories` table)

`id`, `title` (cluster seed headline), `first_seen`, `last_seen`,
`article_count`, `countries` (JSON ISO2 array), `persons` (`[]` — PLANNED),
`organizations` (`[]` — PLANNED), `source_diversity` (distinct publisher count),
`updated_at`.

## Country extraction (`lib/intel/resolve.ts`)

Country entities are attached, not created, by light NER over the headline:

- `resolveCountry(sourcecountry)` — maps GDELT's source-country code/name to a
  canonical `{iso2, iso3, name, point}` via ISO2/ISO3/name tables + an alias map
  (e.g. `usa→US`, `türkiye→TR`, `drc→CD`). Unmatched input returns `null` — we
  never guess.
- `extractCountryMentions(title)` — word-boundary matchers over all country
  names + notable aliases, **longest-match-first** so "United States" beats
  "States". Returns distinct `ResolvedCountry[]`.

Backed by the bundled Natural Earth centroid table (`data/country-centroids`).

## Not yet extracted (PLANNED)

Persons and organizations require the disabled `wikidata` source. Until wired,
`persons[]`/`organizations[]` on both article and story remain empty arrays.
