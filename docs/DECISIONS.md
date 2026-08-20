# Architecture Decision Records

Short ADR-style records of significant choices. Newest last.

## ADR-001 — Cesium/Resium retained as the globe renderer
**Decision:** Keep CesiumJS (via Resium) rather than switching to Mapbox/MapLibre.
**Reason:** Native 3D globe, terrain, atmosphere, temporal entities, entity
clustering, and a path to orbital/space visualization (SGP4) — all first-class.
**Consequences:** Larger client bundle; runtime assets (Workers/Assets/Widgets)
must be copied to `/public/cesium` (`scripts/copy-cesium.mjs`) and
`window.CESIUM_BASE_URL` set before the first `Viewer` is constructed.

## ADR-002 — Provider framework with an honest data-status envelope
**Decision:** Every source lives behind a `ProviderDefinition` and is run through
`runProvider`, which returns a `ProviderResult<T>` envelope carrying
`status: live | delayed | cached | mock | offline`, `cached`, `stale`,
`fetchedAt`, `error`, `count`.
**Reason:** The product must never present mock or cached data as live. Isolating
sources also lets rendering code stay agnostic of OpenSky vs a mock.
**Consequences:** All API routes return the same envelope shape; the UI renders a
`StatusBadge` from real status. Adding a source is: adapter → definition → route.

## ADR-003 — Zod validation at the trust boundary
**Decision:** External JSON is validated with Zod inside each adapter before
normalization (`fetchValidated` / explicit `Schema.parse`).
**Reason:** External APIs change and lie. Types alone don't protect the runtime.
**Consequences:** A malformed upstream payload fails validation → the provider
framework degrades to cache/mock instead of propagating bad data.

## ADR-004 — Provenance on every externally-derived record
**Decision:** Each normalized entity/event carries a `Provenance` object
(provider, providerRecordId, sourceUrl, retrievedAt, observedAt, confidence,
rawObjectHash, transformationVersion) built via `makeProvenance`.
**Reason:** Analytical discipline — the UI can always answer "where did this come
from and how fresh is it?" The Inspector renders provenance for every entity.
**Consequences:** Slightly larger payloads; a `TRANSFORMATION_VERSION` constant to
bump when normalization changes.

## ADR-005 — Explainable confidence, not hardcoded percentages
**Decision:** Confidence is computed by `scoreConfidence(signals)` returning a
0..1 score **and** the weighted factors, never a magic UI number.
**Reason:** The spec forbids implying certainty; scores must be explainable.
**Consequences:** Providers pass real signals (source count, reliability, age vs
freshness SLA, geo precision). Factor breakdown is available for future UI.

## ADR-006 — Named-field coordinates internally, GeoJSON `[lon, lat]` at edges
**Decision:** Use `{ lat, lon, alt? }` objects in the domain; convert to/from
GeoJSON `[lon, lat]` position tuples only at serialization boundaries
(`lib/core/geo.ts`).
**Reason:** Named fields eliminate the classic lat/lon-swap ambiguity while still
honoring the GeoJSON longitude-first convention where tuples are required.
**Consequences:** One conversion layer; validation via `isValidPoint`.

## ADR-007 — Stable internal IDs decoupled from provider IDs
**Decision:** Internal IDs are `kind:fnv1a(parts)` (`stableId`), deterministic and
independent of any provider's identifier; the provider ID lives in provenance.
**Reason:** Enables future entity resolution / de-duplication across sources.
**Consequences:** IDs survive restarts and are safe React keys.

## ADR-008 — In-memory cache behind a `CacheStore` interface
**Decision:** Ship a module-singleton `MemoryCache` implementing `CacheStore`,
with per-provider TTLs, and stale-while-error semantics.
**Reason:** Keep MVP dependency-free while respecting provider rate limits.
**Consequences:** Cache is per-process (fine for dev/single node). The interface
lets Redis drop in later with no call-site changes.

## ADR-009 — Client store via React Context (no external state lib)
**Decision:** App state (mode, layer visibility, selection, search, polling) lives
in a Context store (`stores/app-store.tsx`); no Redux/Zustand.
**Reason:** Scope is bounded; avoid a heavyweight dependency. Time range and
selection are shared application state, not component-local.
**Consequences:** Feeds poll per-layer at source-appropriate cadences (aircraft
15s / events 60s / news 120s) and only when the layer is enabled.

## ADR-010 — `next lint` replaced by ESLint flat config; Turbopack build
**Decision:** Next 16 removed `next lint` and defaults to Turbopack. Use
`eslint .` with `eslint-config-next`'s flat array; set an empty `turbopack: {}`
and drop the legacy webpack block.
**Reason:** Required for `pnpm lint` / `pnpm build` to work on Next 16.
**Consequences:** `react-hooks/set-state-in-effect` (React-Compiler-era rule) is
downgraded to a warning for legitimate data-fetch/reset effects.

## ADR-011 — No fabricated functionality or intelligence claims
**Decision:** Planned layers/modes are visibly disabled and labelled "PLANNED".
The ticker shows only real signals (no invented market figures). No entity is
labelled with charged terms ("enemy", "criminal", etc.) absent an authoritative
public source with visible provenance.
**Reason:** Product integrity and responsible-intelligence requirements.
**Consequences:** Breadth grows only as real providers are wired.
