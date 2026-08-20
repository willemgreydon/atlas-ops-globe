# Data Model

The canonical domain model lives in `types/domain.ts`. Every externally-derived record is normalized into these shapes before it reaches caching, API routes, or the UI. Design rules are enforced by convention and helpers, not just types.

## Core principles

### Stable internal IDs, independent of provider IDs

Every domain entity has a globally stable internal `id` that is independent of any single provider's identifier. The provider's own key lives only in `provenance.providerRecordId`. This lets the same real-world thing reported by two providers be resolved to one entity later.

`stableId(kind, ...parts)` (`lib/core/id.ts`) produces `"<kind>:<hash>"`, where the hash is a deterministic 32-bit FNV-1a (base36) of the non-empty parts joined by `|`. Deterministic means no randomness — IDs survive process restarts and enable dedup. Example: GDELT news uses `stableId("news", article.url)`. Some adapters compose the ID directly from a namespaced provider ID (e.g. `event:usgs:<id>`, `aircraft:<icao24>`), which is equally stable because the upstream ID is stable.

### Coordinates: named fields internally, GeoJSON tuples at the edge

Internally, all coordinates are named-field `GeoPoint` objects (`{ lat, lon, alt? }`) — unambiguous, no lat/lon transposition bugs. GeoJSON `[lon, lat(, alt)]` tuples appear **only** at serialization boundaries. `lib/core/geo.ts` provides:

- `toPosition(p)` / `fromPosition(pos)` — convert between `GeoPoint` and GeoJSON `Position`.
- `isValidLat` / `isValidLon` / `isValidPoint` — bounds validation; adapters drop records that fail `isValidPoint`.
- `inBounds` (antimeridian-aware) and `haversineKm`.

`alt` is metres above the ellipsoid; negative for depth (e.g. an earthquake hypocentre stored as `-depthKm * 1000`).

### Provenance

Attached to every externally-derived record via `makeProvenance` (`lib/core/provenance.ts`).

| Field | Meaning |
|-------|---------|
| `provider` | Provider key, e.g. `"opensky"`. |
| `providerRecordId?` | The source's own ID for this record. |
| `sourceUrl?` | Link back to the origin. |
| `retrievedAt` | ISO-8601, set when the record was produced. |
| `observedAt?` | When the real-world observation occurred upstream. |
| `confidence?` | 0..1 trust for this single observation. |
| `rawObjectHash?` | Content hash of the raw payload (`hashPayload`). |
| `transformationVersion?` | `TRANSFORMATION_VERSION` — bump on normalization-shape changes. |

### `DataStatus`

`"live" | "delayed" | "cached" | "mock" | "offline"` — the honest liveness of a payload, surfaced in the UI so mock/cached data is never presented as live. Set by `runProvider`; see `docs/PROVIDERS.md`.

### `ProviderResult<T>` envelope

The standard envelope returned by every provider adapter and API route:

| Field | Meaning |
|-------|---------|
| `data` | The payload (`T`). |
| `source` | Provider key, or `"mock"` on fallback. |
| `status` | `DataStatus`. |
| `cached` | Served from cache rather than a fresh call. |
| `stale` | Older than the provider's freshness SLA. |
| `fetchedAt` | When the payload was produced (fetched or read from cache). |
| `error?` | Present when upstream failed and we degraded. |
| `count?` | Record count, for observability. |

API routes spread this and add `rows: result.data` for the client feed layer (`stores/app-store.tsx`). The client mirrors the envelope into `FeedMeta`.

### Confidence model

Confidence is **computed and explainable**, never a hardcoded UI percentage. `scoreConfidence(signals)` (`lib/core/confidence.ts`) returns `{ score, factors }` — a 0..1 score plus a signed factor breakdown so a panel can show *why* a record scored the way it did.

Signals: `sourceCount`, `providerReliability`, `ageSeconds`, `freshnessSlaSeconds`, `geoPrecision`, `conflictingSources`. Weighting:

- **Corroboration** — `1 - 1/(sources+1)`, diminishing (1→0.5, 2→0.67, 3→0.75), × 0.35.
- **Provider reliability** — clamped signal × 0.25 (default 0.6).
- **Freshness decay** — `1 - age/SLA` × 0.2 when both known, else a flat 0.1.
- **Geo precision** — clamped signal × 0.2 (default 0.7).
- **Conflicting sources** — penalty of −0.25.

The sum is clamped to 0..1. Each adapter feeds its provider's `reliability` and a `geoPrecision` estimate; OpenSky additionally feeds real freshness (`ageSeconds` from `lastContact`, 30 s SLA).

## Entities

### Shared primitives
- `Severity` — `"info" | "watch" | "warning" | "critical"`.
- `GeoPoint` — `{ lat, lon, alt? }`.
- `Position` — GeoJSON `[lon, lat]` or `[lon, lat, alt]`.
- `GeoBounds` — `{ west, south, east, north }`.
- `EventKind` — `conflict | disaster | cyber | news | aviation | maritime | space | weather`.

### `WorldEvent` (implemented — USGS, EONET)
`id`, `kind: EventKind`, `title`, `summary?`, `severity`, `occurredAt`, `location: GeoPoint`, `countryCode?`, `source`, `sourceUrl?`, `confidence?`, `tags?`, `provenance?`.

### `AircraftState` (implemented — OpenSky)
`id`, `callsign?`, `country?`, `position: GeoPoint`, `velocityMs?`, `headingDeg?`, `verticalRateMs?`, `onGround?`, `lastContact`, `provenance?`.

### `VesselState` (type exists; no provider yet)
`id`, `mmsi?`, `imo?`, `name?`, `vesselType?`, `flag?`, `position: GeoPoint`, `courseDeg?`, `headingDeg?`, `speedKn?`, `navigationStatus?`, `destination?`, `eta?`, `lastContact`, `provenance?`. The maritime layer/mode is `planned` (AIS provider not wired).

### `NewsItem` (implemented — GDELT)
`id`, `title`, `url?`, `source`, `publishedAt`, `countryCode?`, `people?`, `organizations?`, `themes?`, `location?`, `provenance?`. (GDELT currently populates title/url/source/publishedAt/countryCode; entity fields are reserved for future enrichment.)

### `CountryProfile` (implemented — World Bank)
`iso3`, `iso2?`, `name?`, `region?`, `capital?`, `location?`, `indicators: CountryIndicator[]`, `provenance?`.

### `CountryIndicator`
`code`, `label`, `value: number | null`, `unit?`, `year?`.

### `Alert` (type exists; not yet produced by a provider)
`id`, `title`, `category: EventKind | "system"`, `severity`, `confidence?`, `location?`, `relatedEventId?`, `source`, `createdAt`, `expiresAt?`.

## Implemented vs planned

| Entity | Status | Backing provider |
|--------|--------|------------------|
| `WorldEvent` | Implemented | USGS, NASA EONET |
| `AircraftState` | Implemented | OpenSky |
| `NewsItem` | Implemented | GDELT |
| `CountryProfile` / `CountryIndicator` | Implemented | World Bank |
| `VesselState` | Type only | AIS provider planned |
| `Alert` | Type only | Alerting engine future |
| Person / Organization / Sanction / satellite / cyber entities | Future | Not modeled yet |

Time fields are always explicit ISO-8601 strings.
