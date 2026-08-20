# Intelligence Vault — API Catalog

Per-source reference for every entry in `lib/intel/sources.ts`, plus the
internal read-only `/api/intelligence/*` endpoints.

Status vocabulary (mapped from the source `status` field):

| Registry status | Catalog label | Meaning |
|---|---|---|
| `implemented` | **IMPLEMENTED** | Live ingestor wired, zero-credential unless noted |
| `next` | **NEXT** | Adapter/registry entry present, not yet live-wired |
| `credential-required` | **CREDENTIAL_REQUIRED** | Blocked pending API key / OAuth credential |
| `legal-review` | **LEGAL_REVIEW** | Blocked pending licensing review |
| `research` | **RESEARCH** | Under evaluation |

Rate-limit figures are `acquisition.minIntervalSec` (min seconds between
requests) and `acquisition.cacheTtlSec` (ingestion cache TTL).

---

## External sources

### Natural Earth — `naturalearth` — IMPLEMENTED
- **Domain(s):** global
- **Provider / endpoint:** Natural Earth — `https://www.naturalearthdata.com/`
- **Type:** bulk (bundled seed)
- **Purpose:** Country geometry/centroids; the geographic backbone other domains resolve to. Seeded from bundled `ne_110m_admin_0_countries` centroids (offline).
- **Auth:** none
- **Data format:** bundled centroid data
- **Rate limits:** min interval 5s; cache TTL 31536000s (1 year)
- **Licensing:** Public domain. commercialUse allowed, redistribution allowed, no attribution required.

### GDELT DOC 2.0 — `gdelt` — IMPLEMENTED
- **Domain(s):** news, global
- **Provider / endpoint:** The GDELT Project — `https://api.gdeltproject.org/api/v2/doc/doc`
- **Type:** api (polling)
- **Purpose:** Global news articles + country-mention extraction + heuristic story clustering. Stores metadata and source links only, never full article bodies.
- **Auth:** none
- **Data format:** JSON (returns plain-text on rejection)
- **Rate limits:** min interval 6s (source enforces ~1 req/5s), concurrency 1, cache TTL 120s. Aggressively rate-limited; live runs may degrade.
- **Licensing:** GDELT terms; links/metadata only. commercialUse review-required, redistribution restricted, attribution required ("The GDELT Project"). Do not store full article bodies.

### USGS Earthquakes — `usgs` — IMPLEMENTED
- **Domain(s):** disasters
- **Provider / endpoint:** U.S. Geological Survey — `https://earthquake.usgs.gov/earthquakes/feed/v1.0/`
- **Type:** api (polling)
- **Purpose:** Earthquake feed → canonical disaster events.
- **Auth:** none
- **Data format:** GeoJSON
- **Rate limits:** min interval 30s, cache TTL 60s
- **Licensing:** US Government open data. commercialUse allowed, redistribution allowed, attribution required ("U.S. Geological Survey").

### NASA EONET — `eonet` — IMPLEMENTED
- **Domain(s):** disasters, environment
- **Provider / endpoint:** NASA EONET — `https://eonet.gsfc.nasa.gov/api/v3/`
- **Type:** api (polling)
- **Purpose:** Natural-event tracking (wildfires, storms, volcanoes, etc.) → canonical disaster events.
- **Auth:** none
- **Data format:** JSON
- **Rate limits:** min interval 5s, cache TTL 300s
- **Licensing:** NASA open data. commercialUse allowed, redistribution allowed, attribution required ("NASA EONET").

### World Bank Indicators — `worldbank` — IMPLEMENTED
- **Domain(s):** economics
- **Provider / endpoint:** World Bank Open Data — `https://api.worldbank.org/v2/`
- **Type:** api
- **Purpose:** Country economic indicator time series → `economic_observations`. Seeded for 25 G20 + strategically-watched economies.
- **Auth:** none
- **Data format:** JSON
- **Rate limits:** min interval 1s, concurrency 4, cache TTL 86400s (1 day)
- **Licensing:** CC BY 4.0. commercialUse allowed, redistribution allowed, attribution required ("World Bank Open Data (CC BY 4.0)").

### CISA Known Exploited Vulnerabilities — `cisa-kev` — IMPLEMENTED
- **Domain(s):** cyber
- **Provider / endpoint:** CISA — `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Type:** file (polling)
- **Purpose:** Catalogue of vulnerabilities known exploited in the wild → `vulnerabilities` (kev=1).
- **Auth:** none
- **Data format:** JSON file
- **Rate limits:** min interval 60s, cache TTL 21600s (6h)
- **Licensing:** US Government open data. commercialUse allowed, redistribution allowed, attribution required ("CISA").

### NVD CVE API 2.0 — `nvd` — IMPLEMENTED
- **Domain(s):** cyber
- **Provider / endpoint:** NVD / NIST — `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Type:** api (polling)
- **Purpose:** Recent CVEs with CVSS/CWE metadata → `vulnerabilities`.
- **Auth:** optional (`NVD_API_KEY`)
- **Data format:** JSON
- **Rate limits:** min interval 6s (anonymous ~5 req/30s; higher with API key), concurrency 1, cache TTL 3600s
- **Licensing:** US Government open data. commercialUse allowed, redistribution allowed, attribution required ("NVD / NIST").

### CelesTrak — `celestrak` — IMPLEMENTED
- **Domain(s):** space
- **Provider / endpoint:** CelesTrak — `https://celestrak.org/NORAD/elements/gp.php`
- **Type:** api (polling)
- **Purpose:** Satellite catalogue in OMM (SGP4-ready) elements → `space_objects`. Stores orbital metadata, not propagated positions. Capped at 2000 objects/run (of ~16399); truncation is logged.
- **Auth:** none
- **Data format:** OMM/JSON
- **Rate limits:** min interval 30s, concurrency 1, cache TTL 7200s (2h)
- **Licensing:** CelesTrak terms. commercialUse review-required, redistribution review-required, attribution required ("CelesTrak").

### OpenSky Network — `opensky` — IMPLEMENTED
- **Domain(s):** aviation
- **Provider / endpoint:** The OpenSky Network — `https://opensky-network.org/api/`
- **Type:** api (polling)
- **Purpose:** Live aircraft state snapshot → `aircraft` (latest position per aircraft, upsert). On-demand; snapshot-only, not committed to Git.
- **Auth:** optional (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`)
- **Data format:** JSON state vectors
- **Rate limits:** min interval 10s, cache TTL 10s
- **Licensing:** OpenSky non-commercial/research. commercialUse restricted, redistribution restricted, attribution required ("The OpenSky Network, https://opensky-network.org").

### Wikidata — `wikidata` — NEXT
- **Domain(s):** politics, news
- **Provider / endpoint:** Wikidata — `https://www.wikidata.org/w/api.php`
- **Type:** api
- **Purpose:** Entity enrichment (persons/orgs). Adapter interface present; not live-wired. News persons/organizations are empty until this ships.
- **Auth:** none
- **Data format:** JSON
- **Rate limits:** min interval 2s, cache TTL 604800s (7 days)
- **Licensing:** CC0. commercialUse allowed, redistribution allowed, no attribution required.

### ReliefWeb — `reliefweb` — NEXT
- **Domain(s):** disasters, conflict
- **Provider / endpoint:** OCHA ReliefWeb — `https://api.reliefweb.int/v1/`
- **Type:** api (polling)
- **Purpose:** Humanitarian situation reports / disaster context. Adapter present; not live-wired.
- **Auth:** none (`RELIEFWEB_APPNAME` requested by provider policy)
- **Data format:** JSON
- **Rate limits:** min interval 5s, cache TTL 3600s (1h)
- **Licensing:** OCHA terms. commercialUse review-required, redistribution review-required, attribution required ("OCHA ReliefWeb").

### ACLED — `acled` — CREDENTIAL_REQUIRED
- **Domain(s):** conflict
- **Provider / endpoint:** ACLED — `https://api.acleddata.com/`
- **Type:** api (polling)
- **Purpose:** Armed conflict location & event data. Blocked pending credentials.
- **Auth:** oauth (`ACLED_CLIENT_ID`, `ACLED_CLIENT_SECRET`)
- **Data format:** JSON
- **Rate limits:** min interval 5s, cache TTL 3600s (1h)
- **Licensing:** ACLED licence. commercialUse restricted, redistribution restricted, attribution required ("ACLED").

### AISstream — `aisstream` — CREDENTIAL_REQUIRED
- **Domain(s):** maritime
- **Provider / endpoint:** AISstream — `wss://stream.aisstream.io/v0/stream`
- **Type:** api (websocket, polling)
- **Purpose:** Live AIS vessel positions. Blocked pending API key.
- **Auth:** api-key (`AISSTREAM_API_KEY`)
- **Data format:** JSON over WebSocket
- **Rate limits:** min interval 5s, cache TTL 15s
- **Licensing:** AISstream terms. commercialUse restricted, redistribution restricted, attribution required.

### OurAirports — `ourairports` — NEXT
- **Domain(s):** aviation, infrastructure
- **Provider / endpoint:** OurAirports — `https://davidmegginson.github.io/ourairports-data/airports.csv`
- **Type:** bulk
- **Purpose:** ~78k airports CSV — reference seed. Adapter present; not bulk-loaded this cycle.
- **Auth:** none
- **Data format:** CSV
- **Rate limits:** min interval 5s, cache TTL 604800s (7 days)
- **Licensing:** Public domain. commercialUse allowed, redistribution allowed, no attribution required.

### Open-Meteo — `openmeteo` — NEXT
- **Domain(s):** weather, environment
- **Provider / endpoint:** Open-Meteo — `https://api.open-meteo.com/v1/`
- **Type:** api (polling)
- **Purpose:** Weather observations/forecasts → `weather_observations`. Adapter present; not live-wired.
- **Auth:** none
- **Data format:** JSON
- **Rate limits:** min interval 1s, concurrency 4, cache TTL 900s (15m)
- **Licensing:** CC BY 4.0. commercialUse allowed, redistribution review-required, attribution required ("Open-Meteo (CC BY 4.0)").

### OFAC Sanctions List Service — `ofac` — NEXT
- **Domain(s):** sanctions
- **Provider / endpoint:** US Treasury OFAC — `https://sanctionslist.ofac.treas.gov/`
- **Type:** bulk (polling)
- **Purpose:** Sanctions/SDN list → `sanctions`. Registry entry present; not live-wired.
- **Auth:** none
- **Data format:** bulk list (XML/CSV)
- **Rate limits:** min interval 5s, cache TTL 86400s (1 day)
- **Licensing:** US Government open data. commercialUse allowed, redistribution allowed, no attribution required.

---

## Internal endpoints — `/api/intelligence/*`

All endpoints run on the Node runtime, read from SQLite, and are
`force-dynamic`. List endpoints are paginated: `limit` (1–500, default 100)
and `cursor`/`offset` (default 0). Responses wrap `{ data, page: { limit,
offset, count, nextOffset } }`. Temporal filters accept `since=<n>[m|h|d]`
(e.g. `24h`, `7d`, `60m`). Spatial filters accept `bbox=west,south,east,north`.

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/intelligence/global` | — | Global snapshot (rolled-up counts + highlights) |
| `GET /api/intelligence/stats` | — | `{ generatedAt, counts }` per-table record counts |
| `GET /api/intelligence/countries` | `limit`, `cursor` | Paginated countries (iso2, iso3, name, region, capital, lat, lon) |
| `GET /api/intelligence/countries/[code]` | path `code` (2–3 letters) | Country profile: metadata + economic indicators + latest events + latest news. 400 on bad code, 404 if not found |
| `GET /api/intelligence/events` | `kind`, `country`, `bbox`, `since`, `limit`, `cursor` | Paginated events (all kinds), newest first |
| `GET /api/intelligence/disasters` | `country`, `bbox`, `since`, `limit`, `cursor` | Events filtered to `kind=disaster` |
| `GET /api/intelligence/news` | `country`, `since`, `limit`, `cursor` | Paginated news articles; adds `attribution: "The GDELT Project"` |
| `GET /api/intelligence/cyber` | `kev` (`1`/`true` = KEV only), `since`, `limit`, `cursor` | Paginated vulnerabilities; adds `attribution: "CISA KEV / NVD"` |
| `GET /api/intelligence/space` | `limit`, `cursor` | Paginated space objects (orbit metadata); adds `attribution: "CelesTrak"` |
