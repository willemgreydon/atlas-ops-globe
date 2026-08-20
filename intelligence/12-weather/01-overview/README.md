# weather

**Status: Scaffolded** (folder + planned source; not yet ingesting)

## Purpose
Weather observations and forecasts as point-in-time environmental context for
locations and events.

## Current sources
- None live. Planned: **Open-Meteo** (`openmeteo`, `next`, free).

## Canonical entities
- `WeatherObservation`.

## Update frequency
- Not ingesting. Planned polling (min interval 1s, cache 15m) once wired.

## Storage
- Target: `weather_observations` (schema present); `provenance`. Empty today.

## Known limitations
- No live coverage; `weather_observations` is empty.

## Licensing considerations
- Open-Meteo: CC BY 4.0 — commercial use allowed, redistribution
  **review-required**, attribution required ("Open-Meteo (CC BY 4.0)").

## Next sources
- Wire **Open-Meteo**; consider point queries keyed to events/assets.
