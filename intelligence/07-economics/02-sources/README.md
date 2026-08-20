# 07 · Economics — Sources

A single source feeds this domain, and it is one of the cleanest in the vault:
open license, generous limits.

## World Bank Indicators API — IMPLEMENTED

| Field | Value |
|---|---|
| id | `worldbank` |
| name | World Bank Indicators |
| baseUrl | `https://api.worldbank.org/v2/` |
| type | `api` |
| auth | `none` (no key) |
| domains | `economics` |
| status | `implemented` · `enabled: true` |
| license | **CC BY 4.0** |
| commercialUse | `allowed` |
| redistribution | `allowed` |
| attribution | **required** — "World Bank Open Data (CC BY 4.0)" |
| polling | `false` (slow-moving) |

### Acquisition (rate limits & TTL)

| Setting | Value | Notes |
|---|---|---|
| minIntervalSec | 1 | generous |
| concurrency | 4 | matches `mapPool` fan-out |
| cacheTtlSec | 86400 | ~24h (statistics move slowly) |
| maxRetries | 3 | |

The provider-side `worldBankProvider` sets `ttlMs: 24h` and `reliability: 0.95`.
Runtime pacing adds a `limiter.wait("worldbank", 250)` per country on top of the
4-wide pool.

### Format

JSON. **Every World Bank response is a two-element tuple**
`[paginationMeta, dataArray]`, validated with `z.tuple([...])`
(`CountryMetaSchema`, `IndicatorSchema`). Indicator rows carry
`{ indicator: {id, value}, date, value }`.

### Coverage

Country-level annual indicators. Fetched for `SEED_COUNTRIES` (25 ISO3 codes:
G20 + UKR, IRN, POL, NLD, CHE, AUT). Five indicators each; `mrnev=1` returns the
most-recent non-empty value → the latest available year per indicator.

### Sample URLs

```
https://api.worldbank.org/v2/country/AUT?format=json
https://api.worldbank.org/v2/country/AUT/indicator/NY.GDP.MKTP.CD?format=json&per_page=5&mrnev=1
```

### History & status

Adopted as the country-profile economics backbone; drives the indicators block
on `/api/intelligence/countries/[code]`. Stable and low-risk (open license). No
credential, no redistribution restriction.

### Licensing discipline

CC BY 4.0 permits commercial use and redistribution **with attribution**. Every
observation stores `license: "CC BY 4.0"` and
`attribution: "World Bank Open Data"` in provenance.
