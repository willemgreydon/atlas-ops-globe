# 03 — Aviation · Sources

Per-source dossiers. Grounded in `lib/intel/sources.ts` and the wired providers.

## OpenSky Network — `opensky` — IMPLEMENTED (live)

| Field | Value |
|---|---|
| Name / id | OpenSky Network / `opensky` |
| Domains | aviation |
| Base URL | `https://opensky-network.org/api/` (ingestor hits `/states/all`) |
| Type | api (polling) |
| Auth | `optional` — anonymous today; env keys `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` raise limits |
| Rate limits (acquisition) | `minIntervalSec: 10`, `cacheTtlSec: 10`, `concurrency: 2`, `maxRetries: 3` |
| Licensing | OpenSky non-commercial/research. commercialUse **restricted**, redistribution **restricted** |
| Attribution | required — "The OpenSky Network, https://opensky-network.org" |
| Data format | JSON state vectors — `{ time, states: [tuple,…] }`; each tuple indexed by column order |
| Coverage | Global airborne + on-ground ADS-B; `/states/all` returns all currently tracked aircraft |
| Status / priority | `implemented` / — (live) |

**History / notes.** Live telemetry is high-volume and non-committal, so it is
**snapshot-only and never committed to Git**. The provider validates the
envelope shape (`ResponseSchema`) then indexes each tuple by documented column
index (`icao24=0, callsign=1, originCountry=2, lastContact=4, lon=5, lat=6,
baroAltitude=7, onGround=8, velocity=9, trueTrack=10, verticalRate=11`). Rows
failing `isValidPoint` are dropped.

**Sample request.**
```
GET https://opensky-network.org/api/states/all
```

## OurAirports — `ourairports` — NEXT (planned, not loaded)

| Field | Value |
|---|---|
| Name / id | OurAirports / `ourairports` |
| Domains | aviation, infrastructure |
| Base URL | `https://davidmegginson.github.io/ourairports-data/airports.csv` |
| Type | bulk (CSV) |
| Auth | none |
| Rate limits (acquisition) | `cacheTtlSec: 604800` (7 days); defaults otherwise |
| Licensing | Public domain. commercialUse **allowed**, redistribution **allowed**, no attribution |
| Data format | CSV (~78k airport rows) |
| Coverage | Global airport reference (ICAO/IATA, name, country, lat/lon, type) |
| Status / priority | `next` / Medium — airport reference seed |

**Notes.** Adapter/registry entry present but the ~78k CSV is **not bulk-loaded
this cycle**. The `airports` table schema exists (migration v1) and is empty
until this source is wired. Would target `airport:icao-<ICAO>` IDs.

**Sample request (planned).**
```
GET https://davidmegginson.github.io/ourairports-data/airports.csv
```
