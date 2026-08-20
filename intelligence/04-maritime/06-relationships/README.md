# 04 — Maritime · Relationships

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` (`lib/intel/ontology.ts`).
Every edge carries a `basis` so inferred/near links are never presented as fact.

## Applicable relation types

| Relation | From → To | Basis | Status |
|---|---|---|---|
| `FLAGGED_IN` | Vessel → Country | `direct` | PLANNED (flag column exists) |
| `NEAR` | Vessel → Chokepoint/Location | `spatially-near` | PLANNED |
| `LOCATED_IN` | Vessel → Country | `spatially-near` | PLANNED |
| `DEPARTED_FROM` | Voyage → Port | `reported` | PLANNED |
| `ARRIVED_AT` | Voyage → Port | `reported` | PLANNED |
| `OWNED_BY` / `OPERATED_BY` | Vessel → Company | `reported` | PLANNED |

## Current reality

The maritime ingestor writes **no relationship rows** today — it upserts
`vessels` and the chokepoint snapshot only. All edges above are modelled but not
emitted (no Port/Company entities, no country resolution wired for vessels).

## Conservative linking principles

- **Chokepoint membership is `spatially-near`.** A vessel is inside a bbox
  geofence, which is a spatial fact, not a direct "transiting" claim.
- **Destination/ETA are `reported`, not `direct`.** `DESTINATION` and `ETA` are
  self-reported AIS fields, frequently stale or free-text — a `DEPARTED_FROM` /
  `ARRIVED_AT` edge from them is `reported` and low-confidence.
- **A signal gap is not an edge.** Missing AIS is a **signal gap**, never an
  inferred "dark voyage" relationship or an accusation.
- **Flag ≠ owner.** `FLAG` gives `FLAGGED_IN`; ownership/operator would require
  a separate registry and be `reported`.

## Concrete examples (illustrative, once implemented)

```
vessel:imo-9743493  NEAR        chokepoint:suez   basis=spatially-near  conf=0.6
vessel:imo-9743493  FLAGGED_IN  country:PA        basis=direct
vessel:imo-9743493  ARRIVED_AT  port:unlocode-NLRTM  basis=reported     conf=0.4
```

Cross-domain: chokepoint transit counts (this domain) feed situational context
that could link to news/events near the same geofence via `spatially-near` /
`temporally-related` bases — not wired today.
