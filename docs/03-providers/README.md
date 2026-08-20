# Providers

How Atlas Ops Globe turns external data sources into trustworthy, honestly-labelled domain records.

## The provider framework

A **provider adapter** normalizes exactly one external source into domain records. It knows nothing about HTTP envelopes, caching, or the UI. All cross-cutting concerns live in `runProvider` (`lib/core/provider.ts`), which wraps a `ProviderDefinition` with TTL caching, honest liveness status, graceful degradation, and structured logging.

Rendering code and API routes only ever see a `ProviderResult<T>` (`types/domain.ts`). They never learn whether data came from OpenSky, a cache, or a mock — only its `status`. That isolation is the architectural invariant the app depends on.

### `ProviderDefinition<T>` contract

Defined in `lib/core/provider.ts`:

| Field | Type | Meaning |
|-------|------|---------|
| `key` | `string` | Stable key, e.g. `"opensky"`. Also the default cache key. |
| `label` | `string` | Human label for docs/registry. |
| `ttlMs` | `number` | How long a successful fetch stays "live" before refetch. |
| `reliability?` | `number` | 0..1 weight fed to the confidence engine. |
| `enabled?` | `boolean` | When `false`, the upstream call is skipped and mock data is served flagged `offline` — never `live`. |
| `fetch()` | `() => Promise<T>` | Fetch + Zod-validate + normalize fresh records from upstream. |
| `mock()` | `() => T` | Demo/empty fallback when upstream fails and no cache exists. |

Providers whose fetch is parameterized (query, ISO code) are exposed as **factory functions** that return a `ProviderDefinition` — see `gdeltProvider(query)` and `worldBankProvider(iso3)`. Those pass an explicit `cacheKey` to `runProvider` so distinct inputs don't clobber each other's cache entries.

### `runProvider` lifecycle

`runProvider(def, { cacheKey? })` resolves to a `ProviderResult<T>` by walking these branches in order:

| Condition | `source` | `status` | `cached` | `stale` |
|-----------|----------|----------|----------|---------|
| `enabled === false` (not configured) | `mock` | `offline` | false | true |
| Cache entry fresh (`freshUntil > now`) | `def.key` | `live` | true | false |
| Fetch succeeds | `def.key` | `live` | false | false |
| Fetch throws, stale cache exists | `def.key` | `cached` | true | true |
| Fetch throws, no cache | `mock` | `mock` | false | true |

On a successful fetch the result is written to cache with `def.ttlMs`. Failures **never** throw a 500 out of the route — the worst case is honestly-labelled mock data. Every branch emits one JSON log line (`lib/core/logger.ts`) with `provider`, `status`, `records`, and (on failure) `error`.

### `mergeArrayResults`

Fuses several array-valued `ProviderResult`s into one envelope (`lib/core/provider.ts`). Rules:

- **Rows** are concatenated (`flatMap`).
- **Status** is the *least trustworthy* contributor, ranked `live > delayed > cached > mock > offline`. A fused layer is only as live as its weakest source.
- `cached`/`stale` are `true` if any contributor is.
- `error` concatenates each failing source's message as `source: message`.

Used by the events route to combine EONET + USGS into `"eonet+usgs"`.

### Per-provider TTL caching

The cache (`lib/core/cache.ts`) is a module-level in-memory `MemoryCache` singleton implementing the `CacheStore` contract (`get`/`set`/`delete`/`clear`). Entries store `value`, `storedAt`, and an absolute `freshUntil = now + ttlMs`. `isFresh(entry)` is a simple `freshUntil > Date.now()` check — this gives **stale-while-error** semantics: a stale entry is still retained and served if the next fetch fails. The same contract can be backed by Redis in production without touching call sites.

### Zod validation at the trust boundary

External data is never assumed to match our types. Each adapter defines a Zod schema and parses the raw payload before normalization — the schema *is* the trust boundary. `lib/fetch-json.ts` offers `fetchValidated(url, schema)` for the common case; adapters with quirky payloads (OpenSky's tuple arrays, GDELT's plain-text rate-limit responses, World Bank's `[meta, data]` tuples) parse manually. A validation failure throws, which `runProvider` turns into graceful degradation.

### Provenance tagging

Every normalized record carries a `Provenance` object built with `makeProvenance` (`lib/core/provenance.ts`): `provider`, `providerRecordId`, `sourceUrl`, `retrievedAt` (set to now), `observedAt`, `confidence`, `rawObjectHash` (content hash via `hashPayload`), and `transformationVersion` (`TRANSFORMATION_VERSION`, bumped when normalization output changes shape). Confidence is computed per-record with `scoreConfidence` (`lib/core/confidence.ts`), never hardcoded.

## Active providers

Five providers are wired end-to-end. Values pulled directly from `lib/providers/*.ts` and `data/provider-registry.ts`.

| Key | Source | Category | Endpoint | Auth | Cache TTL | Reliability |
|-----|--------|----------|----------|------|-----------|-------------|
| `opensky` | OpenSky Network (ADS-B) | aviation | `https://opensky-network.org/api/states/all` | none (anon; OAuth optional) | 10 s | 0.85 |
| `usgs` | USGS Earthquakes | naturalHazards | `.../feed/v1.0/summary/4.5_day.geojson` | none | 60 s | 0.97 |
| `eonet` | NASA EONET | naturalHazards | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100` | none | 300 s (5 m) | 0.90 |
| `gdelt` | GDELT DOC 2.0 | news | `https://api.gdeltproject.org/api/v2/doc/doc` | none | 120 s (2 m) | 0.70 |
| `worldbank` | World Bank Indicators | economics | `https://api.worldbank.org/v2/country/...` | none | 24 h | 0.95 |

Notes:
- OpenSky caps results at 3000 states per fetch. Optional OAuth client credentials (`OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET`) raise the anonymous ~400 req/day quota.
- `worldbank` key is per-country (`worldbank:<ISO3>`); it fetches five indicators (population, GDP, GDP per capita, inflation, unemployment) in parallel.

**Planned providers** (maritime AIS, ACLED, ReliefWeb, CISA KEV, NVD, Wikidata, CelesTrak, Open-Meteo, OFAC) are catalogued in `data/provider-registry.ts` with `status: "planned"`. Their UI controls render disabled — no fake functionality. See `docs/LICENSING.md`.

## Adding a new provider

1. **Write the adapter** in `lib/providers/<name>.ts`:
   - Define a Zod schema for the upstream payload.
   - Implement a `fetch<Name>()` that calls `fetchJson`/`fetchValidated`, parses, and normalizes into domain records. Use `stableId(...)` for internal IDs (or a `provider:recordId` string), drop invalid coordinates with `isValidPoint`, and compute per-record confidence via `scoreConfidence`.
   - Attach `makeProvenance({ provider, providerRecordId, sourceUrl, observedAt, confidence, rawObjectHash: hashPayload(raw) })` to each record.
   - Provide a `mock()` fallback (usually a filter over `lib/mock.ts`).
2. **Export a `ProviderDefinition`** (or a factory returning one for parameterized fetches) with `key`, `label`, `ttlMs`, `reliability`, `fetch`, `mock`.
3. **Add an API route** at `app/api/<name>/route.ts` that calls `runProvider(def, { cacheKey })` and returns `NextResponse.json({ ...result, rows: result.data })`. Set `export const dynamic = "force-dynamic"`. Validate any query params (see `docs/SECURITY.md`).
4. **Register it** in `data/provider-registry.ts` with licensing fields (`commercialUse`, `redistribution`, `attribution`, `status`, `envKeys`, `rateLimit`). This drives the `/api/health` config report and `docs/LICENSING.md`.
5. **Add a layer/mode** if it is UI-facing: a `LayerDef` in `lib/config/layers.ts` (with `feed` + `eventKinds`), and optionally a `ModeDef` in `lib/config/modes.ts`. Wire the feed into `stores/app-store.tsx` (`useFeed` + a `POLL_MS` interval) so it only polls when the layer is enabled.

## Rate-limit / caching discipline

The TTLs below are the actual `ttlMs` values in code, chosen against each source's freshness and courtesy limits. The client polls each feed on its own interval (`stores/app-store.tsx`) and only while the backing layer is enabled — so an off layer generates zero upstream traffic.

| Provider | Cache TTL | Client poll interval | Upstream rate-limit note |
|----------|-----------|----------------------|--------------------------|
| `opensky` (aircraft feed) | 10 s | 15 s | Anon ~400 req/day; higher with OAuth. |
| `usgs` (events feed) | 60 s | 60 s | No hard limit; be courteous, cache 60s+. |
| `eonet` (events feed) | 300 s | 60 s | Courtesy limits; cache 5m+. |
| `gdelt` (news feed) | 120 s | 120 s | Soft limits; avoid rapid polling, cache 2m+. |
| `worldbank` (country, on demand) | 24 h | on selection | Generous; statistics move slowly. |

The events route merges USGS + EONET, so the 60 s poll is bounded by each provider's own TTL. `fetchJson` enforces a hard 9 s timeout (GDELT's text path uses 20 s) so a slow upstream degrades rather than hangs.
