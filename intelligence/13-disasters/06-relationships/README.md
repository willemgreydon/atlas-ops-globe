# 06 — Disasters Relationships

Disasters mint exactly one kind of edge today: `event OCCURRED_IN country`,
established by `linkEventCountry` (`lib/intel/enrich.ts`) via `relate()`.

## Relation type + basis

| Relation | Basis | Confidence | When |
|---|---|---|---|
| `OCCURRED_IN` | `reported` | 0.85 | Source supplied the country code |
| `OCCURRED_IN` | `spatially-near` | 0.6 | Country resolved by nearest centroid |

Basis values come from `RELATIONSHIP_BASIS` in `lib/intel/ontology.ts`:
`direct`, `reported`, `spatially-near`, `temporally-related`, `entity-overlap`,
`inferred-low-confidence`.

## Concrete examples

```
event:usgs:us7000abcd   OCCURRED_IN  country:JP   [reported]        conf 0.85
event:usgs:us7000wxyz   OCCURRED_IN  country:CL   [spatially-near]  conf 0.6
event:eonet:EONET_6543  OCCURRED_IN  country:AU   [spatially-near]  conf 0.6
```

Edge id is deterministic: `stableId("rel", from, "OCCURRED_IN", to)`, so
re-syncs upsert the same edge. Stored in `relationships`:

| Column | Value |
|---|---|
| from_id | `event:<provider>:<id>` |
| type | `OCCURRED_IN` |
| to_id | `country:<ISO2>` |
| basis | `reported` / `spatially-near` |
| confidence | 0.85 / 0.6 |

## Conservative-linking discipline

- The basis is a **first-class field** — a nearest-centroid link is never
  presented as a hard fact; it is labeled `spatially-near` at lower confidence.
- No `AFFECTED_BY`, `INVOLVES`, or infrastructure-impact edges are minted; those
  require impact data (ReliefWeb, `next`) not yet wired.
- Events over open ocean or without a valid point are skipped, never linked to a
  guessed country.
