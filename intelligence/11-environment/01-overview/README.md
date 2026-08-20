# 11 — Environment Intelligence

**Status: SCAFFOLDED** — no dedicated environment ingestion. Coverage today is
only the incidental **NASA EONET** overlap surfaced through the *disasters*
domain. Everything below is the *intended* build.

## Mission

Track slow-moving and continuous environmental conditions — the context layer
beneath acute disasters: air quality, water quality, vegetation, drought, soil
moisture, sea-surface temperature, and ice. The aim is a time-aware,
provenance-tracked observation store that supports a **time-slider** over
environmental state, so conditions can be replayed and correlated with events.

Ground truth: `lib/intel/sources.ts` tags two sources to `environment` —
`eonet` (`implemented`, shared with disasters) and `openmeteo` (`next`,
`enabled:false`, Air Quality API planned). `manifest.json`:
`sources: ["eonet","openmeteo"]`,
`canonicalEntities: ["EnvironmentalObservation"]`,
`storage: ["weather_observations","entities","provenance"]`.

## At a glance (all PLANNED except EONET overlap)

- **Planned sources:** Copernicus CAMS, NASA (EONET live; other products
  planned), NOAA, Open-Meteo Air Quality (registered `next`), Sentinel
  (Copernicus), EPA.
- **Tracked variables (planned):** air quality — PM2.5, PM10, NO2, SO2, CO,
  ozone, aerosol, dust, smoke; plus water quality, vegetation, drought, soil
  moisture, sea-surface temperature, ice.
- **Planned entity:** `EnvironmentalObservation` (in `ENTITY_TYPES`).
- **Intended tables:** point/station observations in `weather_observations`
  (reused); raster products as **metadata + external/object-storage references**
  in `entities`/`provenance` (never giant JSON blobs).
- **Planned CLI:** `pnpm intel:sync environment` once
  `INGESTORS["environment"]` exists (absent → `! unknown domain`).

## Raster discipline

Raster datasets (CAMS/Sentinel/NOAA grids) are stored as **metadata records**
pointing to external URLs or object storage — the vault keeps the reference,
extent, time, variable, and provenance, not the pixels.

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
