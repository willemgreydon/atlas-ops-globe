# 02 — Disasters Sources

Two live sources feed disasters, plus one planned humanitarian source.

## USGS Earthquakes — `usgs`

| Field | Value |
|---|---|
| Name / id | USGS Earthquakes / `usgs` |
| Domains | `disasters` |
| Type | `api` (polling) |
| baseUrl | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/` |
| Endpoint used | `summary/4.5_day.geojson` (M4.5+ over last 24h) |
| Auth | `none` |
| minIntervalSec | 30 |
| cacheTtlSec | 60 |
| concurrency | 2 · maxRetries 3 |
| License | US Government open data |
| commercialUse / redistribution | allowed / allowed |
| attribution | required — "U.S. Geological Survey" |
| Data format | GeoJSON (`features[].geometry.coordinates`, `.properties`) |
| Coverage | Global earthquakes, magnitude ≥ 4.5 |
| History depth | Rolling 24h window (feed variant `4.5_day`) |
| **Status** | **IMPLEMENTED** |
| Priority | — (live) |

**Sample request**

```
GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson
```

Provider reliability constant `0.97`. Severity from magnitude: ≥6 `critical`,
≥5 `warning`, else `watch`.

## NASA EONET — `eonet`

| Field | Value |
|---|---|
| Name / id | NASA EONET / `eonet` |
| Domains | `disasters`, `environment` |
| Type | `api` (polling) |
| baseUrl | `https://eonet.gsfc.nasa.gov/api/v3/` |
| Endpoint used | `events?status=open&limit=100` |
| Auth | `none` |
| minIntervalSec | 5 |
| cacheTtlSec | 300 |
| concurrency | 2 · maxRetries 3 |
| License | NASA open data |
| commercialUse / redistribution | allowed / allowed |
| attribution | required — "NASA EONET" |
| Data format | JSON (`events[]` with `categories`, `geometry`, `sources`) |
| Coverage | Wildfires, storms, volcanoes, and other open natural events |
| History depth | Open (currently-active) events, up to 100 per fetch |
| **Status** | **IMPLEMENTED** |
| Priority | — (live) |

**Sample request**

```
GET https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100
```

Provider reliability constant `0.9`. All EONET events default to `watch`
severity; subtype/tags come from EONET category titles.

## ReliefWeb — `reliefweb` (PLANNED)

| Field | Value |
|---|---|
| id | `reliefweb` |
| Domains | `disasters`, `conflict` |
| Type | `api` · baseUrl `https://api.reliefweb.int/v1/` · auth `none` (`RELIEFWEB_APPNAME` requested) |
| cacheTtlSec | 3600 |
| License | OCHA terms — commercialUse review-required, redistribution review-required, attribution "OCHA ReliefWeb" |
| **Status** | **NEXT** — adapter present, not live-wired |
| Priority | Medium — would add humanitarian situation/impact context |
