# 07 · Economics — Relationships

Economics is a **columnar / join** domain rather than a graph domain: an
observation belongs to a country by foreign key (`country_code`), so the current
ingestor writes **no `relationships` rows**. Linkage is expressed structurally
and surfaced by the country-profile join.

## Structural linkage (IMPLEMENTED)

| From | Relation (conceptual) | To | Mechanism |
|---|---|---|---|
| observation | belongs-to | `country:<ISO2>` | `economic_observations.country_code` FK |

`getCountryProfile(code)` (`lib/intel/queries.ts`) joins observations onto the
country by `country_code`, returning them under the profile's `indicators` array
— this is where the country↔economics tie is realized at read time.

## Ontology fit

If materialized as graph edges (a future option), the natural mapping from
`RELATION_TYPES` would be:

| Edge | Type | Basis | Rationale |
|---|---|---|---|
| indicator → country | `OBSERVED_BY` / `LOCATED_IN` | `direct` | value is directly attributed to the country by the World Bank |

Basis would be `direct` (from `RELATIONSHIP_BASIS`): the World Bank attributes
each value to a specific country and year — no inference involved.

## Conservative discipline

- **No cross-country edges are invented.** Economic similarity, trade links, or
  correlation (`TRADES_WITH`, `RELATED_TO`) are **not** asserted — they would be
  inferred, and the vault does not present inference as fact.
- **No temporal edges.** Year-over-year change is a derived metric (see §07), not
  a stored relationship.
- Provenance on every observation records the exact source, dataset, year and
  license, so the country attribution is always auditable.

## Summary

Today the country association is a **direct foreign-key join**, not a graph
edge. That is the honest representation: the data is a country-scoped time
series, and the join is exact and provenance-backed.
