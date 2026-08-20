# 04 — Maritime · Sources

## MarineTraffic AIS Data API (Kpler) — `marinetraffic` — IMPLEMENTED adapter, CREDENTIAL-REQUIRED

| Field | Value |
|---|---|
| Name / id | MarineTraffic AIS Data API (Kpler) / `marinetraffic` |
| Domains | maritime |
| Base URL | `https://services.marinetraffic.com/api` (adapter uses `/exportvessels/<api_key>`) |
| Type | api (polling) |
| Auth | `api-key` — 40-char hex key in the **URL PATH**; env `MARINETRAFFIC_API_KEY` |
| Rate limits (acquisition) | `minIntervalSec: 2`, `cacheTtlSec: 60`, `concurrency: 1`, `maxRetries: 3`. Ingestor also paces `limiter.wait("marinetraffic", 1500)` per chokepoint |
| Licensing | Property of Kpler — credit-metered. commercialUse **restricted**, redistribution **restricted** |
| Attribution | required — "MarineTraffic" |
| Data format | `protocol=jsono&msgtype=extended` array of vessel records (PS07 `exportvessels`) |
| Coverage | Vessels inside a bbox (MINLAT/MAXLAT/MINLON/MAXLON) within `timespan` minutes |
| Status / priority | `credential-required` — OFFLINE without key |

**Wiring.** Adapter `lib/intel/providers/marinetraffic.ts` implements
`exportvessels` (PS07 bbox). The registry notes other services exist
(`exportvessel`, `exportvesseltrack`, `portcalls`, `port-congestion`,
`shipsearch`) but only `exportvessels` is wired. **Every call is credit-metered.**

**Numeric conventions.** Per the API, `SPEED` and `DRAUGHT` are in tenths; the
adapter converts `speedKn = SPEED / 10` (knots×10 → knots). Identity is
**IMO-first** then MMSI; MarineTraffic's `"0"` sentinel for unknown IMO/MMSI is
treated as **absent** (`id0` helper). Records with neither IMO nor MMSI, or
failing `isValidPoint`, are dropped.

**Sample request.**
```
GET https://services.marinetraffic.com/api/exportvessels/<40-hex-key>?v=8&protocol=jsono&msgtype=extended&MINLAT=25.5&MAXLAT=27.1&MINLON=55.0&MAXLON=57.2&timespan=60
```

## AISstream — `aisstream` — CREDENTIAL-REQUIRED (planned, not wired)

| Field | Value |
|---|---|
| Name / id | AISstream / `aisstream` |
| Base URL | `wss://stream.aisstream.io/v0/stream` (WebSocket) |
| Type | api (websocket, polling) |
| Auth | `api-key` — env `AISSTREAM_API_KEY` |
| Rate limits | `cacheTtlSec: 15` |
| Licensing | AISstream terms. commercialUse **restricted**, redistribution **restricted**, attribution required |
| Status | `credential-required` — no adapter wired; blocked on key |

Planned live AIS stream. No ingestor exists today; listed as a future maritime
feed alongside MarineTraffic.
