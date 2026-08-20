# 06 — Global Relationships

Global is the **target** of most cross-domain edges: other domains link their
records to a `country:<ISO2>` node that global seeded. Edges use
`RELATION_TYPES` and carry a `RELATIONSHIP_BASIS` so an inferred/near link is
never presented as a hard fact (`lib/intel/ontology.ts`, `lib/intel/enrich.ts`).

## Relevant relation types

| Type | Meaning |
|---|---|
| `OCCURRED_IN` | An event/article occurred in a country |
| `LOCATED_IN` | An asset/entity is located in a country/region |
| `MEMBER_OF` | Country ∈ region/organization |

## Relationship basis vocabulary

`direct`, `reported`, `spatially-near`, `temporally-related`, `entity-overlap`,
`inferred-low-confidence`. Global-targeted edges are mostly `reported` (country
code came from the source) or `spatially-near` (nearest-centroid resolution).

## Concrete examples

```
event:usgs:us7000abcd  OCCURRED_IN  country:JP   [spatially-near]  conf 0.6
event:eonet:EONET_1234 OCCURRED_IN  country:AU   [reported]        conf 0.85
news:<hash>            OCCURRED_IN  country:UA   [reported]        conf 0.7
```

Edges are minted with `relate()` (deterministic id `stableId("rel", from, type,
to)`) and stored in the `relationships` table:

| Column | Notes |
|---|---|
| id | `stableId("rel", from, type, to)` |
| from_id → to_id | source node → `country:<ISO2>` |
| type | `OCCURRED_IN`, … |
| basis | `reported` / `spatially-near` |
| confidence | 0.85 (reported) / 0.6 (near) for events; 0.7 for articles |

## Conservative-linking discipline

- The country node must already exist from the seed; edges are never created to
  invented country ids.
- `spatially-near` is explicitly weaker (lower confidence) than `reported` and
  is surfaced as such — nearest-centroid resolution can misattribute near
  borders/coasts.
- No speculative country-to-country edges (`TRADES_WITH`, alliances) are minted;
  those require entity resolution not yet wired.
