# 10 — Infrastructure Intelligence

**Status: SCAFFOLDED** — one planned reference source (`ourairports`, status
`next`), nothing ingesting. `airports`/`ports`/`entities` hold no infrastructure
rows today. Everything below is the *intended* build.

## Mission

Maintain a reference inventory of the fixed, public infrastructure that anchors
every other domain in space: airports, ports, rail, roads, bridges, tunnels,
power lines, pipelines, data centers, submarine cables, telecom towers, and key
public facilities. This layer is the spatial backbone — events, vessels,
aircraft, and energy assets resolve *against* it.

Ground truth: `lib/intel/sources.ts` registers one infrastructure-tagged source,
`ourairports` (`domains: ["aviation","infrastructure"]`, `enabled: false`,
`status: "next"`). `manifest.json`: `sources: ["ourairports"]`,
`canonicalEntities: ["InfrastructureAsset","Airport","Port"]`,
`storage: ["airports","ports","entities","provenance"]`.

## At a glance (all PLANNED)

- **Planned sources:** OpenStreetMap / Overpass, OpenInfraMap, Geofabrik
  (regional OSM extracts), OurAirports (registered, `next`), government open-data
  portals.
- **Planned entities:** `InfrastructureAsset` super-type + specializations
  `Airport`, `Port` (both first-class ontology types), and via `data.subtype`:
  Railway, Highway, Bridge, Tunnel, PowerPlant, PowerLine, Pipeline, DataCenter,
  SubmarineCable, TelecomTower, Hospital, GovernmentBuilding, IndustrialFacility,
  Dam, WaterInfrastructure.
- **Intended tables:** dedicated `airports` and `ports` tables (exist in
  `migrations.ts`) plus the generic `entities` table (typed
  `InfrastructureAsset`) and `provenance`.
- **Planned CLI:** `pnpm intel:sync infrastructure` once
  `INGESTORS["infrastructure"]` exists (absent today → `! unknown domain`).

## Collection discipline

Only legitimate, public situational-awareness detail from reputable public
sources. Do **not** collect security-sensitive specifics (guard posts, internal
layouts, targeting-grade detail) beyond what such sources already publish.

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
