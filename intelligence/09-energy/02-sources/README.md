# 09 — Energy · Sources (PLANNED)

None of these are registered in `lib/intel/sources.ts` yet
(`sourcesForDomain("energy")` returns `[]`). Each entry is a planned dossier to
be reified as a `SourceRecord` when wired. Licensing uses the conservative
`LicenseStance` vocabulary (`unknown | review-required | allowed | restricted`).

### EIA — US Energy Information Administration — PLANNED
- **baseUrl:** `https://api.eia.gov/v2/`
- **type:** api · **auth:** api-key (`EIA_API_KEY`) · **rate:** generous;
  plan `minIntervalSec: 1`, `cacheTtlSec: 86400`
- **licensing:** US Government open data → `commercialUse: allowed`,
  `redistribution: allowed`, attribution courtesy
- **format:** JSON · **coverage:** US generation, capacity, fuel mix, prices
- **history:** decades of series · **priority:** High (free, authoritative, US)
- **sample:** `https://api.eia.gov/v2/electricity/operating-generator-capacity/data/?api_key=KEY`

### ENTSO-E Transparency Platform — PLANNED
- **baseUrl:** `https://web-api.tp.entsoe.eu/api`
- **type:** api · **auth:** token (`ENTSOE_TOKEN`) · **rate:** ~400 req/min;
  plan `minIntervalSec: 1`, `cacheTtlSec: 3600`
- **licensing:** ENTSO-E terms → `review-required` for redistribution
- **format:** XML · **coverage:** EU electricity — generation, load, cross-border
  flows, interconnectors · **history:** since 2015 · **priority:** High (EU grid)
- **sample:** `https://web-api.tp.entsoe.eu/api?documentType=A44&in_Domain=10YAT-APG------L`

### Ember — PLANNED
- **baseUrl:** `https://ember-energy.org/` (data portal / API)
- **type:** api/bulk · **auth:** optional · **rate:** low volume, `cacheTtlSec: 86400`
- **licensing:** CC BY 4.0 → `allowed`, attribution required
- **format:** CSV/JSON · **coverage:** global electricity generation by fuel,
  emissions intensity · **history:** annual + monthly · **priority:** Medium

### Eurostat — PLANNED
- **baseUrl:** `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/`
- **type:** api · **auth:** none · **licensing:** Eurostat reuse policy →
  `allowed`, attribution required · **format:** JSON-stat
- **coverage:** EU energy balances, imports/exports, prices · **priority:** Medium

### Global Energy Monitor (GEM) — PLANNED
- **baseUrl:** `https://globalenergymonitor.org/`
- **type:** bulk (tracker spreadsheets) · **auth:** none/registration
- **licensing:** CC BY 4.0 (varies per tracker) → `review-required`
- **format:** XLSX/CSV · **coverage:** global plant-level trackers (coal, gas,
  oil, wind, solar, hydro, nuclear, LNG terminals, pipelines) with lat/lon,
  status, capacity · **priority:** High (best asset-level global inventory)

### OpenStreetMap / Overpass — PLANNED
- **baseUrl:** `https://overpass-api.de/api/interpreter`
- **type:** api · **auth:** none · **rate:** strict fair-use, plan
  `minIntervalSec: 10`, `concurrency: 1`, `cacheTtlSec: 604800`
- **licensing:** ODbL → `redistribution: review-required` (share-alike),
  attribution required · **format:** JSON/XML · **coverage:** `power=*`
  (plant, substation, line, tower), `pipeline=*` · **priority:** Medium

### National grid operators — PLANNED
- Bundle of operator open-data portals (e.g. National Grid ESO, RTE, TenneT).
- **type:** api/file · **auth:** varies · **licensing:** per-operator,
  default `unknown` until reviewed · **priority:** Low (long tail, per-country)

> **Discipline:** register each source with a real `SourceRecord` before any
> live wiring; never claim a permission not verified — default new sources to
> `enabled: false`, `status: "research"`.
