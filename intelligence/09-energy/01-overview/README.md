# 09 — Energy Intelligence

**Status: SCAFFOLDED** — no source is wired for this domain. Everything below
describes the *intended* build. There is no live energy data in the vault today.

## Mission

Provide standing situational awareness of energy infrastructure and supply:
generation assets, transmission, and the fuel-handling facilities that move
hydrocarbons and electricity across borders. The goal is a queryable, provenance-
tracked inventory of *where* energy assets are, *who* operates them, *what* they
can produce, and *how* they connect — so that disruptions (outages, sanctions,
conflict, weather) can be reasoned about against a real asset graph.

Ground truth: `lib/intel/sources.ts` currently registers **no** source for the
`energy` domain (`sourcesForDomain("energy")` returns `[]`). The domain
`manifest.json` lists `sources: []`, `canonicalEntities: ["EnergyAsset"]`,
`storage: ["entities", "provenance"]`.

## At a glance (all PLANNED)

- **Planned sources:** EIA (US), ENTSO-E (EU electricity), Ember, Eurostat,
  Global Energy Monitor, OpenStreetMap / Overpass (power features), national
  grid operators. None registered yet.
- **Planned entities:** one canonical super-type `EnergyAsset`, specialized via
  the `data.subtype` field into PowerPlant, Substation, Pipeline, Refinery,
  LNGTerminal, OilTerminal, GasStorage, Interconnector, HydroelectricDam,
  WindFarm, SolarFarm, NuclearPlant.
- **Intended tables:** reuse the generic `entities` table (typed `EnergyAsset`)
  plus `provenance`. No dedicated energy table exists in `migrations.ts`.
- **Planned CLI:** an `energy` ingestor registered into `INGESTORS`, invoked via
  `pnpm intel:sync energy`. Not implemented — `INGESTORS["energy"]` is absent, so
  `intel sync energy` prints `! unknown domain: energy`.

## Contents

- [02 — Sources](../02-sources/README.md) — planned source dossiers
- [03 — Entities](../03-entities/README.md) — EnergyAsset + universal IDs
- [04 — Schemas](../04-schemas/README.md) — Zod shapes + example JSON
- [05 — Pipeline](../05-pipeline/README.md) — intended ingestion + target tables
- [06 — Relationships](../06-relationships/README.md) — planned edges
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md) — metrics + gaps
