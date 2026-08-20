# 12 — Weather · Relationships (PLANNED)

Edges use `RELATION_TYPES` + `RELATIONSHIP_BASIS` (`lib/intel/ontology.ts`),
stored via `upsertRelationship()`. No weather edges exist yet.

## Applicable relation types

- `OCCURRED_IN` / `LOCATED_IN` — Observation/Forecast/System → Country/Region/City
- `AFFECTED_BY` — Event / Airport / Port / EnergyAsset / Country →
  WeatherObservation / WeatherSystem (e.g. an airport under a storm)
- `NEAR` — Observation → Observation, or WeatherSystem → asset
- `OVERLAPS` — WeatherSystem track/footprint over an area or asset
- `OBSERVED_BY` — Observation → Satellite/GroundStation/source model
- `RELATED_TO` — generic soft link (e.g. weather ↔ disaster/flight-delay)
- `SOURCE_OF` — model/dataset → derived observation

## Basis vocabulary

`direct` · `reported` · `spatially-near` (point/extent proximity) ·
`temporally-related` (same time window) · `entity-overlap` ·
`inferred-low-confidence`.

## Examples (PLANNED, illustrative)

```json
{ "from": "airport:icao-EDDF", "type": "AFFECTED_BY",
  "to": "wxsystem:storm-kirk", "basis": "spatially-near", "confidence": 0.6 }

{ "from": "wxobs:openmeteo:temperature:48.2:16.4:2026-08-20T12",
  "type": "LOCATED_IN", "to": "country:AT", "basis": "spatially-near",
  "confidence": 0.7 }

{ "from": "wxsystem:cyclone-x", "type": "OVERLAPS",
  "to": "port:unlocode-INMAA", "basis": "spatially-near", "confidence": 0.5 }
```

## Conservative linking

Weather edges are overwhelmingly `spatially-near` and `temporally-related` —
both the location match and the time window must hold. A weather system's impact
on an asset/event (`AFFECTED_BY`) is drawn from geometry+time, defaulting to
`confidence: 0.5`, and is **not** promoted to a `direct` causal claim (e.g.
"storm caused delay") without a source stating it. Because forecasts carry an
issue **and** a target time, temporal edges match on the **target** time; the
issue time is metadata, never the join key.
