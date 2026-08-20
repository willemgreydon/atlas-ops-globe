# 16 — Space · Sources

## CelesTrak — `celestrak` — IMPLEMENTED (live)

| Field | Value |
|---|---|
| Name / id | CelesTrak / `celestrak` |
| Domains | space |
| Base URL | `https://celestrak.org/NORAD/elements/gp.php` |
| Type | api (polling) |
| Auth | none |
| Rate limits (acquisition) | `minIntervalSec: 30`, `cacheTtlSec: 7200` (2h), `concurrency: 1`, `maxRetries: 3` |
| Licensing | CelesTrak terms. commercialUse **review-required**, redistribution **review-required** |
| Attribution | required — "CelesTrak" |
| Data format | GP element sets in **OMM JSON** (`FORMAT=json`), SGP4-ready |
| Coverage | Selectable groups (e.g. `active`, ~16,399 objects available); capped 2000/run |
| Status / priority | `implemented` / — (live) |

**What is fetched.** `fetchCelestrak(group)` GETs
`gp.php?GROUP=<group>&FORMAT=json` and parses an array of OMM records with
`OmmSchema`: `OBJECT_NAME`, `OBJECT_ID` (COSPAR), `NORAD_CAT_ID`, `EPOCH`,
`MEAN_MOTION` (revs/day), `ECCENTRICITY`, `INCLINATION`.

**Derived, not raw.** The adapter computes orbit geometry from the elements
(`deriveOrbit`) using Earth GM (`MU = 398600.4418 km³/s²`) and radius
(`6378.137 km`):
- `periodMin = 1440 / MEAN_MOTION`
- semi-major axis `a = cbrt(MU / n²)` where `n = MEAN_MOTION·2π/86400`
- `apogeeKm = a·(1+e) − Rₑ`, `perigeeKm = a·(1−e) − Rₑ` (rounded to 0.1)

It stores this **orbit metadata, not thousands of propagated positions**.

**Sample request.**
```
GET https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json
```

**History / notes.** Truncation to `limit` (default 2000) is logged with
`log.warn("celestrak result capped", { records, kept })` — never silent. TLE
line1/line2 fields exist in the schema but are not populated by the OMM-JSON
path (the adapter emits derived elements, not raw TLE lines).
