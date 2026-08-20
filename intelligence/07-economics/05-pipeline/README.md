# 07 · Economics — Pipeline

Entry point: `ingestEconomics(countries = SEED_COUNTRIES)` in
`lib/intel/domains/economics.ts`, wrapped by
`runIngestor({ domain: "economics", source: "worldbank", job: "indicators-sync" }, …)`.

## Stages

1. **Fan-out** — `mapPool(countries, 4, …)` (`lib/intel/pool.ts`) processes up
   to 4 countries concurrently. Bounded concurrency respects the API and caps
   memory.
2. **Pace** — before each country, `await limiter.wait("worldbank", 250)` adds a
   250ms floor between requests.
3. **Fetch** — `fetchCountryProfile(iso3)` (`lib/providers/worldbank.ts`) issues
   the country-meta call plus 5 indicator calls in parallel (`Promise.all`),
   each via `latestIndicator(… mrnev=1)`. Tuple-shaped responses are Zod-parsed.
4. **Transform + skip** — for each indicator, `c.fetched++`; if `value == null`
   or no `year`, `c.skipped++` and continue. Otherwise build `VaultEconomicObs`
   with `IdOf.indicatorObs(iso2 ?? iso3, code, year)`.
5. **Persist** — `upsertEconomicObs()` → `economic_observations` + `provenance`.
   `c.created++`. Any per-country throw → `c.failed++` (isolated, job continues).

## CLI

| Command | Effect |
|---|---|
| `pnpm intel:sync economics` | sync all 25 seed countries |
| `pnpm intel:sync --all` | includes economics |
| `pnpm intel:bootstrap` | economics runs early (cheap/offline-friendly) |
| `pnpm intel:update` | economics included in incremental refresh |
| `pnpm intel:stats` | shows Economic Obs count |

## Cadence & TTL

Non-polling. `cacheTtlSec: 86400` (~24h); provider `ttlMs` 24h. Statistics are
annual and move slowly, so a daily-ish refresh is ample. Included in both
`BOOTSTRAP_ORDER` and `UPDATE_ORDER` (`lib/intel/registry.ts`).

## Tables & columns

- **`economic_observations`** — `id, country_code, indicator, label, unit,
  frequency, period, value, provider, provenance`. Indexes: `country_code`,
  `indicator`.
- **`countries`** — country metadata (name, region, capital, lat/lon) joined in
  the profile endpoint.
- **`provenance`** — shared; one row per observation.

## Provenance & retention

Each observation writes provenance (provider, dataset=indicator, record id
`iso3:code:year`, `observedAt` = year-end, CC BY 4.0 license, attribution,
`retrievedAt`, transformation). Upserts are idempotent on the composite id; a
new fetch of the same country/indicator/year overwrites `value` in place. No TTL
eviction — the latest annual value persists until refreshed.

## Concurrency primitives

`mapPool` (bounded worker pool) and `limiter` (per-key spacing) live in
`lib/intel/pool.ts`. Together they keep the 25×6 request burst within polite
bounds without serializing the whole job.
