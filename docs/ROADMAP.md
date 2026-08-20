# Roadmap

Phased delivery. The rule throughout: **working vertical slices over broad
unfinished breadth**, and the project stays runnable at every step.

Status key: ✅ done · 🟡 partial · ⬜ planned

## Phase 1 — Foundation ✅
- ✅ Repo stabilized: `pnpm dev/build/lint/typecheck/test` all pass
- ✅ Domain model + provenance + data-status model
- ✅ Provider framework (`runProvider`, `ProviderDefinition`, `mergeArrayResults`)
- ✅ Confidence engine, geo helpers, stable IDs, in-memory cache, structured logger
- ✅ App shell, globe shell, layer framework, inspector framework

## Phase 2 — First live intelligence ✅ (milestone)
- ✅ OpenSky aircraft (clustering, heading icons)
- ✅ USGS earthquakes
- ✅ NASA EONET natural events
- ✅ GDELT news
- ✅ World Bank country indicators
- ✅ Honest LIVE/CACHED/MOCK/OFFLINE everywhere

## Phase 3 — Global UX 🟡
- ✅ ⌘K command palette (countries/events/news/aircraft)
- ✅ Country / event / news / aircraft inspectors with provenance
- ✅ Alert center, layer manager, telemetry, ticker
- 🟡 Global timeline / historical replay (shared time-range state) — **next**
- ⬜ Source inspector page; saved views

## Phase 4 — Maritime ⬜
- ⬜ AIS provider abstraction (mock provider, clearly labelled)
- ⬜ Vessel model (type exists), trails, course arrows
- ⬜ Chokepoint geofences + transit counters + AIS-gap anomaly (neutral terms)

## Phase 5 — Entity graph ⬜
- ⬜ Persons / organizations, Wikidata resolution, relationships, entity panels

## Phase 6 — Environment ⬜
- ⬜ Weather / wind / clouds / air quality / fires (raster + vector layer split)

## Phase 7 — Geopolitical intelligence ⬜
- ⬜ ACLED, ReliefWeb, sanctions (OFAC/EU/UK/UN), event fusion with thresholds

## Phase 8 — Infrastructure, economics, cyber, space ⬜
- ⬜ CISA KEV / NVD / EPSS (non-spatial where geo is weak)
- ⬜ CelesTrak + SGP4 orbits, ground tracks
- ⬜ Energy infrastructure, markets ticker (labelled real-time vs delayed)

## Cross-cutting infrastructure (as load requires)
- ⬜ Redis-backed `CacheStore`; Postgres/PostGIS canonical store
- ⬜ TimescaleDB/ClickHouse for tracks & observations
- ⬜ Ingestion workers + raw-snapshot object storage
- ⬜ SSE/WebSocket delta channel
- ⬜ OpenSearch full-text; OpenTelemetry/Sentry
- ⬜ RBAC, workspaces, provider entitlement gating

## Immediate next steps
1. Shared time-range state + historical replay wiring for time-aware layers.
2. Viewport-based aircraft querying (bounds param on `/api/aircraft`) + LOD.
3. Provider adapter unit tests with mocked upstreams (opensky/usgs normalizers).
4. Maritime mock provider to exercise the vessel model end-to-end.
