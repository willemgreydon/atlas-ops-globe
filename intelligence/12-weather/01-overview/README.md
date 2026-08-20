# 12 — Weather Intelligence

**Status: SCAFFOLDED** — one planned source (`openmeteo`, status `next`), not
ingesting. `weather_observations` is empty. Everything below is the *intended*
build.

## Mission

Provide point-in-time and forecast weather context for every location, event,
and asset in the vault: the atmospheric layer that explains and predicts
conditions around what the other domains track. Open-Meteo is the designated
backbone (free, CC BY 4.0), with ECMWF/NOAA/DWD/MET Norway as authoritative
model sources to layer in.

Ground truth: `lib/intel/sources.ts` tags `openmeteo`
(`domains: ["weather","environment"]`, `enabled: false`, `status: "next"`) as
the weather backbone. `manifest.json`: `sources: ["openmeteo"]`,
`canonicalEntities: ["WeatherObservation"]`,
`storage: ["weather_observations","provenance"]`.

## At a glance (all PLANNED)

- **Planned sources:** Open-Meteo (**NEXT**, CC BY 4.0 — registered), ECMWF,
  NOAA, DWD, MET Norway.
- **Planned entities:** `WeatherObservation` (in `ENTITY_TYPES`), plus intended
  `WeatherForecast` and `WeatherSystem` (see 03 — not yet in the ontology).
- **Tracked variables (planned):** temperature, precipitation, wind, pressure,
  clouds, visibility, snow, humidity, storms, lightning.
- **Target table:** `weather_observations(lat, lon, observed_at, variable, value,
  unit, provider, …)` — exists in `migrations.ts`, empty.
- **Planned CLI:** `pnpm intel:sync weather` once `INGESTORS["weather"]` exists
  (absent today → `! unknown domain: weather`).

## Time & layer discipline

- **Observation vs forecast time:** a forecast carries a distinct **issue time**
  (when the model ran / was published) and **target time** (the time being
  predicted). These are kept separate, never conflated.
- **Raster vs vector:** gridded model output (raster) is handled separately from
  point/station observations (vector) — the two are distinct layers.

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
