# Architecture for detail-grade global situational awareness

> **Implemented today (Phase 1–2).** The sections below describe the full target
> architecture. What currently ships: a Next.js client (Cesium/Resium globe +
> Context store), server API routes that return a uniform `ProviderResult`
> envelope, a provider framework (`lib/core/provider.ts`) with per-source Zod
> validation, provenance, an in-memory `CacheStore`, an explainable confidence
> engine, and structured JSON logging. The production data stores, queue and
> streaming layers below are **interfaces to grow into**, not yet wired — the
> call sites (`CacheStore`, `ProviderDefinition`) are shaped so Redis/Postgres/
> SSE can drop in without changing rendering code. See `docs/ROADMAP.md`.
>
> Key modules: `lib/core/{provider,cache,confidence,provenance,geo,id,logger}.ts`,
> `lib/providers/*`, `stores/app-store.tsx`, `components/{globe,layout,panels,search}`.


## 1. Client

Next.js web app with CesiumJS/Resium. Render only a viewport-relevant subset of entities. Use clustering and progressive detail: country heatmap at planet scale, event clusters at regional scale, individual aircraft/vessels only after zoom thresholds.

## 2. API gateway / BFF

The browser talks only to your own APIs. Responsibilities: auth, workspace permissions, geospatial query window, layer selection, rate limiting, cache headers, payload shaping and feature flags.

## 3. Ingestion workers

One connector per external source. Each connector writes both the raw source payload (object storage, immutable) and normalized records (database). Streaming sources (ADS-B/AIS) use long-running workers; polling feeds use provider-appropriate cadence.

## 4. Normalization pipeline

Recommended normalized objects:

- `Observation`: raw measured point/time/value from a source.
- `Track`: ordered observations for a moving asset.
- `Asset`: aircraft, vessel, satellite, facility, infrastructure node.
- `Event`: conflict, disaster, cyber, political, economic or environmental event.
- `Entity`: person, organization, country, place, product, weapon system etc.
- `Claim`: source-attributed statement derived from a document.
- `Indicator`: numeric time series.
- `Relationship`: edge between any objects.
- `Evidence`: source URI, retrieval time, licence, hash and raw-object pointer.

Every normalized record should carry provider, source ID, retrieved-at time, observed-at time, confidence, geospatial precision, freshness SLA and licensing flags.

## 5. Storage

- PostgreSQL + PostGIS: canonical entities, geo queries, workspaces, ACL, relationships.
- ClickHouse or TimescaleDB: high-volume tracks / observations / telemetry.
- Redis: hot caches, geospatial tiles, sessions and pub/sub.
- S3-compatible object storage: raw provider payloads, snapshots, raster/tile artifacts.
- OpenSearch: full-text search over reports/news/entities.
- Optional graph DB: Neo4j/Memgraph when graph traversal becomes a core workload; otherwise relational edge tables work well initially.

## 6. Event fusion

Use deterministic deduplication before AI: time window + geodistance + normalized title/entity overlap + source-specific identifiers. Then apply a confidence model that weighs source reliability, source independence, geospatial precision, corroboration count, freshness and contradiction.

## 7. Entity extraction

Use provider-native entities where possible (GDELT/Event Registry/Diffbot). For raw articles, run NER and entity linking server-side. Resolve people/organizations to Wikidata IDs. Store article -> entity -> event edges with evidence, not just model-generated prose.

## 8. Streaming to browser

Workers publish deltas to Kafka/Redpanda/NATS. A stream service fans relevant deltas to connected clients via WebSocket or SSE. The client requests snapshots via REST and receives updates via stream.

## 9. Geospatial delivery

Do not send millions of points as JSON. Generate vector tiles or use server-side spatial queries per viewport/zoom. For tracks, decimate geometry based on screen resolution. For weather/fire/cloud raster layers use tile services/COGs/WMTS where licensing permits.

## 10. Security

Secrets remain server-side. Separate provider credentials by environment. Maintain provider-specific retention rules. Log source provenance and user access to sensitive layers. Add workspace-level entitlements for commercial datasets.
