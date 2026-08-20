# 16 — Space · Relationships

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` (`lib/intel/ontology.ts`).
Every edge carries a `basis`, so inferred links are never presented as fact.

## Applicable relation types

| Relation | From → To | Basis | Status |
|---|---|---|---|
| `OPERATED_BY` | Satellite → Organization | `direct`/`reported` | PLANNED (operator not populated) |
| `REGISTERED_IN` | Satellite → Country | `direct` | PLANNED (country not populated) |
| `OBSERVED_BY` | Satellite → GroundStation | `direct` | PLANNED (no ground stations) |
| `NEAR` | Satellite ↔ Satellite | `spatially-near` | PLANNED (needs propagation) |
| `OVERLAPS` | Orbit ↔ Orbit | `inferred-low-confidence` | PLANNED |

## Current reality

The space ingestor writes **no relationship rows** today — it upserts
`space_objects` only. Operator, country, and object type are not populated by
the OMM path, so no `OPERATED_BY` / `REGISTERED_IN` edges can be derived yet.
`NEAR` / conjunction analysis would require SGP4 **propagation**, which is not
implemented.

## Conservative linking principles

- **No positions → no proximity edges.** Because only orbit *metadata* is stored
  (not propagated positions), any `NEAR`/`OVERLAPS` conjunction edge would be
  `inferred-low-confidence` and is deliberately not emitted.
- **Operator/country need a catalogue join.** OMM JSON does not carry operator
  or launch country; deriving `OPERATED_BY` / `REGISTERED_IN` requires a SATCAT
  enrichment source (not wired). Until then, no such edges.
- **COSPAR encodes launch, not ownership.** `cospar` (e.g. `1998-067A`) hints at
  a launch year/sequence but is not treated as an ownership relation.

## Concrete examples (illustrative, once implemented)

```
satellite:norad-25544  REGISTERED_IN  country:US   basis=direct
satellite:norad-25544  OPERATED_BY    org:<NASA>   basis=reported
satellite:norad-25544  NEAR           satellite:norad-48274  basis=spatially-near  conf=0.3
```

Cross-domain: satellites could relate to ground infrastructure or launch
providers, but those entities are not ingested.
