# environment

**Status: Scaffolded** (folder + planned sources; no dedicated ingestion)

## Purpose
Environmental observations and natural-event context beyond acute disasters —
long-running natural phenomena and environmental variables.

## Current sources
- None dedicated. Overlaps **NASA EONET** (`eonet`) via the disasters domain.
  Planned: **Open-Meteo** (`openmeteo`, `next`, free) for environmental
  variables.

## Canonical entities
- `EnvironmentalObservation` (and shared `DisasterEvent` from EONET).

## Update frequency
- Not ingesting in this domain. EONET events land under disasters.

## Storage
- Target: `weather_observations` / `entities`; `provenance`. No
  environment-specific rows today.

## Known limitations
- No dedicated environment ingestion; coverage is only the EONET overlap
  surfaced through disasters.

## Licensing considerations
- EONET: NASA open data (attribution required). Open-Meteo: CC BY 4.0,
  redistribution review-required, attribution required.

## Next sources
- Wire **Open-Meteo** environmental variables; separate environmental events
  from acute disasters.
