# 11 — Environment · Relationships (PLANNED)

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` (`lib/intel/ontology.ts`),
stored via `upsertRelationship()`. No environment edges exist yet.

## Applicable relation types

- `OCCURRED_IN` / `LOCATED_IN` — Observation/raster → Country/Region
- `OBSERVED_BY` — Observation → Satellite/GroundStation/source dataset
- `AFFECTED_BY` — Country/InfrastructureAsset/EnergyAsset → EnvironmentalObservation
  (e.g. a region under a dust/smoke plume, an asset in poor air quality)
- `NEAR` — Observation → Observation (co-located)
- `OVERLAPS` — raster extents overlapping an area/asset
- `RELATED_TO` — generic soft link (e.g. env condition ↔ disaster event)
- `SOURCE_OF` — dataset → derived observation

## Basis vocabulary

`direct` · `reported` · `spatially-near` (extent/proximity join) ·
`temporally-related` (same time window) · `entity-overlap` ·
`inferred-low-confidence`.

## Examples (PLANNED, illustrative)

```json
{ "from": "envraster:cams-dust-2026-08-20", "type": "OVERLAPS",
  "to": "country:LY", "basis": "spatially-near", "confidence": 0.6 }

{ "from": "country:AT", "type": "AFFECTED_BY",
  "to": "envobs:openmeteo:pm2_5:48.2:16.4:2026-08-20T00",
  "basis": "reported", "confidence": 0.7 }

{ "from": "envobs:sst-…", "type": "OBSERVED_BY",
  "to": "satellite:norad-…", "basis": "direct", "confidence": 0.9 }
```

## Conservative linking

Environmental edges are almost always `spatially-near` or `temporally-related` —
the vault does not assert a hard `direct` cause between an environmental
condition and an event/asset without a source that states it. Raster→area
`OVERLAPS`/`AFFECTED_BY` edges default to `confidence: 0.5` and are driven by
geometry, not inference. Correlation with disaster events (`RELATED_TO`) is
`inferred-low-confidence` unless a source links them.
