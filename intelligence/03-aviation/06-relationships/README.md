# 03 — Aviation · Relationships

Edges use the controlled vocabulary in `lib/intel/ontology.ts`
(`RELATION_TYPES`) and always carry a `basis` from `RELATIONSHIP_BASIS`, so an
inferred link is never presented as a hard fact.

## Applicable relation types

| Relation | From → To | Basis | Status |
|---|---|---|---|
| `LOCATED_IN` | Aircraft → Country | `spatially-near` | PLANNED |
| `OPERATED_BY` | Aircraft → Airline | `direct` | PLANNED |
| `REGISTERED_IN` | Aircraft → Country | `direct` | PLANNED |
| `DEPARTED_FROM` | Flight → Airport | `direct`/`reported` | PLANNED |
| `ARRIVED_AT` | Flight → Airport | `direct`/`reported` | PLANNED |
| `NEAR` | Aircraft → Chokepoint/Location | `spatially-near` | PLANNED |

## Current reality

The aviation ingestor writes **no relationship rows today**. It only upserts
`aircraft`. Every edge above is modelled by the ontology but not yet emitted,
because Flight/Airport/Airline entities are not ingested.

## Conservative linking principles

- **Registration ≠ operator.** OpenSky's `originCountry` is the country of the
  registered airframe, not a live operator or flight origin. Any
  `REGISTERED_IN` edge would use it; `OPERATED_BY` must wait for airline data.
- **Position → country is `spatially-near`, not `direct`.** A `LOCATED_IN` edge
  derived from lat/lon over a country would carry the `spatially-near` basis and
  can misattribute aircraft over borders/coasts.
- **Callsign is not identity.** A callsign in the `aircraft` row is not a
  resolved Flight or Airline entity; deriving `DEPARTED_FROM`/`ARRIVED_AT`
  requires flight-plan data (not present) and would be `reported` at best.

## Concrete examples (illustrative, once implemented)

```
aircraft:icao24-3c6dd2  REGISTERED_IN  country:DE   basis=direct
aircraft:icao24-3c6dd2  LOCATED_IN     country:DE   basis=spatially-near
aircraft:icao24-3c6dd2  NEAR           <chokepoint> basis=spatially-near
```

Cross-domain: aircraft positions could be joined to maritime chokepoint
geofences (`lib/intel/geo/chokepoints.ts`) via a `NEAR` edge, but this is not
wired.
