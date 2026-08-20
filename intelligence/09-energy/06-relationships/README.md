# 09 — Energy · Relationships (PLANNED)

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` from `lib/intel/ontology.ts`
and are stored via `upsertRelationship()` into the `relationships` table
(`id, from_id, type, to_id, basis, valid_from, valid_to, confidence, provenance`).
No energy edges exist yet.

## Applicable relation types (from `RELATION_TYPES`)

- `LOCATED_IN` — EnergyAsset → Country/Region/City
- `OPERATED_BY` — EnergyAsset → Organization/Company
- `OWNED_BY` — EnergyAsset → Organization/Company
- `NEAR` — EnergyAsset → EnergyAsset / InfrastructureAsset (proximity)
- `OVERLAPS` — pipeline/interconnector footprints
- `AFFECTED_BY` — EnergyAsset → Event/DisasterEvent (outage, damage)
- `RELATED_TO` — generic soft link
- `SOURCE_OF` / `OBSERVED_BY` — provenance-style links to producing datasets

Interconnectors and pipelines are modelled as assets whose two endpoints are
`LOCATED_IN` different countries — the cross-border relationship falls out of the
endpoint geography rather than a bespoke edge type.

## Basis vocabulary (from `RELATIONSHIP_BASIS`)

`direct` (registry states operator) · `reported` (from a source document) ·
`spatially-near` (nearest-centroid / proximity join) · `temporally-related` ·
`entity-overlap` (same operator/owner resolved across sources) ·
`inferred-low-confidence`.

## Examples (PLANNED, illustrative)

```json
{ "from": "energy-asset:dukovany", "type": "LOCATED_IN",
  "to": "country:CZ", "basis": "reported", "confidence": 0.95 }

{ "from": "energy-asset:nordstream", "type": "OPERATED_BY",
  "to": "org:Q1636245", "basis": "direct", "confidence": 0.9 }

{ "from": "energy-asset:substation-x", "type": "NEAR",
  "to": "energy-asset:plant-y", "basis": "spatially-near", "confidence": 0.5 }
```

## Conservative linking

Per the vault's design: an operator link is `direct` only when the source
registry states it; otherwise `reported`. Proximity edges (`NEAR`,
`spatially-near`) start at `confidence: 0.5` (the schema default) and are never
promoted to `direct` grid-connectivity claims without a source that actually
models the connection (e.g. ENTSO-E interconnector data). Operator-to-org edges
are blocked until the Wikidata adapter (status `next`) resolves organizations.
