# 10 — Infrastructure · Relationships (PLANNED)

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` (`lib/intel/ontology.ts`),
stored via `upsertRelationship()` into `relationships`. No infrastructure edges
exist yet.

## Applicable relation types

- `LOCATED_IN` — Asset/Airport/Port → Country/Region/City
- `OPERATED_BY` / `OWNED_BY` — Asset → Organization/Company (port authority,
  rail operator, airport operator)
- `NEAR` — Asset → Asset (co-located infrastructure)
- `OVERLAPS` — linear assets sharing corridors (rail/road/pipeline)
- `DEPARTED_FROM` / `ARRIVED_AT` — Flight→Airport, Voyage→Port (cross-domain,
  set by aviation/maritime, terminating on these anchors)
- `AFFECTED_BY` — Asset → Event/DisasterEvent (closure, damage)
- `RELATED_TO` — generic soft link

## Basis vocabulary

`direct` (authoritative registry states it) · `reported` · `spatially-near`
(proximity join) · `temporally-related` · `entity-overlap` (same operator across
sources) · `inferred-low-confidence`.

## Examples (PLANNED, illustrative)

```json
{ "from": "airport:icao-EDDF", "type": "LOCATED_IN",
  "to": "country:DE", "basis": "direct", "confidence": 0.95 }

{ "from": "port:unlocode-DEHAM", "type": "OPERATED_BY",
  "to": "org:Q699604", "basis": "reported", "confidence": 0.7 }

{ "from": "infra-asset:datacenter-x", "type": "NEAR",
  "to": "energy-asset:substation-y", "basis": "spatially-near", "confidence": 0.5 }
```

## Conservative linking

Airports/ports link to countries as `direct` when the source carries the ISO
code; otherwise `spatially-near` via nearest-centroid. Operator edges are
`direct` only from an authoritative registry, else `reported`. Proximity
(`NEAR`) edges default to `confidence: 0.5` and never imply a functional
connection. Operator→org resolution is blocked on the Wikidata adapter
(`next`). Given the collection discipline, edges asserting dependency between
critical assets are only drawn from reputable public sources — never inferred to
targeting-grade specificity.
