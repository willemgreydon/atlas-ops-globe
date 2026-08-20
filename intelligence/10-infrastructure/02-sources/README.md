# 10 — Infrastructure · Sources

One source is registered (`ourairports`, `next`); the rest are planned dossiers.
Licensing uses the conservative `LicenseStance` vocabulary.

### OurAirports — `ourairports` — REGISTERED (status: next)
- **baseUrl:** `https://davidmegginson.github.io/ourairports-data/airports.csv`
- **type:** bulk · **auth:** none · **polling:** false
- **rate:** `cacheTtlSec: 604800` (7 days) · **format:** CSV
- **licensing:** Public domain → `commercialUse: allowed`,
  `redistribution: allowed`, `attributionRequired: false`
- **coverage:** ~78k airports worldwide (ICAO/IATA, type, lat/lon, country)
- **history:** continuously maintained · **status:** `next` (`enabled:false`);
  adapter present, **not bulk-loaded this cycle** — `airports` table is empty
- **priority:** Medium (airport reference seed; shared with aviation)
- **sample:** `https://davidmegginson.github.io/ourairports-data/airports.csv`

### OpenStreetMap / Overpass — PLANNED
- **baseUrl:** `https://overpass-api.de/api/interpreter`
- **type:** api · **auth:** none · **rate:** strict fair-use →
  `minIntervalSec: 10`, `concurrency: 1`, `cacheTtlSec: 604800`
- **format:** JSON/XML · **licensing:** ODbL → `redistribution: review-required`
  (share-alike), attribution required
- **coverage:** `aeroway`, `harbour`/`port`, `railway`, `highway`, `bridge`,
  `tunnel`, `man_made`, `power`, `pipeline`, `amenity=hospital`, `office=government`
- **priority:** High (broadest global infrastructure geometry)
- **sample:** Overpass QL: `way["aeroway"="aerodrome"](bbox);out center;`

### OpenInfraMap — PLANNED
- **baseUrl:** `https://openinframap.org/` (OSM-derived tiles/data)
- **type:** api/bulk · **auth:** none · **licensing:** ODbL (OSM) →
  `review-required` · **coverage:** power grid, telecom, pipelines rendered from
  OSM · **priority:** Medium (curated infra view over OSM)

### Geofabrik — PLANNED
- **baseUrl:** `https://download.geofabrik.de/`
- **type:** bulk · **auth:** none · **format:** PBF/shapefile
- **licensing:** ODbL → `review-required` · **coverage:** regional OSM extracts
  (per-country/continent) for offline bulk infra loading · **priority:** Medium

### Government open data — PLANNED
- Bundle of national/EU portals (transport ministries, port authorities, rail
  operators). **type:** api/file · **auth:** varies · **licensing:** per-portal,
  default `unknown` until reviewed · **coverage:** authoritative asset registries
  (ports, rail networks, bridges) · **priority:** Low (long tail, per-country)

> **Discipline:** every source reified as a `SourceRecord` with `enabled: false`
> until wired; ODbL share-alike (OSM, OpenInfraMap, Geofabrik) is flagged
> `redistribution: review-required`. Collect only public situational-awareness
> detail — no security-sensitive specifics beyond what these sources publish.
