# 05 · News — Relationships

Edges use the controlled vocabulary in `lib/intel/ontology.ts`
(`RELATION_TYPES`, `RELATIONSHIP_BASIS`) and are written through
`relate()`/`linkArticleCountry()` in `lib/intel/enrich.ts`. Every edge records
**how** it was established (`basis`) so an inferred link is never presented as a
hard fact.

## Implemented edge

| From | Type | To | Basis | Confidence |
|---|---|---|---|---|
| `news:<hash>` (article) | `OCCURRED_IN` | `country:<ISO2>` | `reported` | 0.70 |

Created by `linkArticleCountry(articleId, iso2)` for **each** country resolved
from the article's source country and headline mentions. The `reported` basis
means the tie comes from source metadata / headline text, not from geolocation
or inference.

## Edge identity

`stableId("rel", from, type, to)` → idempotent upsert via `upsertRelationship()`
(`ON CONFLICT(id) DO UPDATE`). Re-ingesting the same article/country pair does
not duplicate edges.

## Relevant relation types (from `RELATION_TYPES`)

`OCCURRED_IN` (used), `MENTIONS`, `INVOLVES`, `RELATED_TO` — the latter three
are reserved for the PLANNED person/org NER layer (article `MENTIONS` person /
`INVOLVES` organization).

## Relationship basis vocabulary

`direct`, `reported` (**used here**), `spatially-near`, `temporally-related`,
`entity-overlap`, `inferred-low-confidence`. Confidence for news country edges
is fixed at 0.70 in `enrich.ts` — high enough to be useful, low enough to signal
it derives from metadata rather than precise geocoding.

## Conservative linking discipline

- **No guessing.** `resolveCountry`/`extractCountryMentions` return only
  boundary-matched, alias-resolved countries; unmatched text yields no edge.
- **Longest-match-first** avoids spurious substring ties.
- **Story membership is not an edge** — it is a column (`story_id`) plus the
  `news_stories` aggregate, tracking **source lineage** (`source_diversity`)
  rather than manufacturing consensus from repeated wire copy.
- **Persons/orgs produce no edges yet (PLANNED)** — arrays are empty, so no
  low-confidence entity edges are fabricated.

## Example (conceptual)

```
news:9f2c…  --OCCURRED_IN[reported,0.70]-->  country:RU
news:9f2c…  --OCCURRED_IN[reported,0.70]-->  country:UA
```

A single article mentioning two countries yields two distinct `reported` edges.
