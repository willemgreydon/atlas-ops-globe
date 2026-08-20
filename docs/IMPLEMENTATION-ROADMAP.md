# Implementation roadmap

## Phase 1 — working globe (1-2 weeks)
- Cesium globe + country/border layer
- OpenSky aircraft
- NASA EONET + USGS hazards
- GDELT headlines
- World Bank country cards
- viewport filtering, clustering, provider health

## Phase 2 — operational source fusion (2-5 weeks)
- Postgres/PostGIS + Redis
- ingestion workers + raw snapshot storage
- canonical event/entity model
- Wikidata entity linking
- ACLED + ReliefWeb + CISA/NVD
- SSE/WebSocket delta channel
- alert rules and saved views

## Phase 3 — transport intelligence (3-6 weeks)
- commercial AIS integration
- vessel tracks, port/chokepoint geofences
- transit counters, vessel classes, anomaly rules
- richer aviation source + schedules/airport status

## Phase 4 — atmosphere / EO / advanced analytics
- weather tiles / CAMS air quality
- FIRMS fires + Sentinel imagery
- temporal playback
- source corroboration and confidence scoring
- relationship graph: event <-> person <-> org <-> country <-> asset

## Phase 5 — enterprise hardening
- RBAC, workspaces and tenant isolation
- audit log and evidence provenance
- provider entitlements / licence gates
- observability, quota dashboards and schema-drift detection
- SLOs, disaster recovery, load tests and cost controls
