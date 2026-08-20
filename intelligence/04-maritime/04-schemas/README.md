# 04 — Maritime · Schemas

The canonical schema is **`VaultVessel`** (`lib/intel/schemas.ts`). External
MarineTraffic payloads are validated against a source schema (`VesselSchema` /
`ResponseSchema` in the adapter), transformed, then conform to `VaultVessel`
before storage. Malformed records are dropped, never stored raw.

## Source validation (adapter)

`normalizeVessels` parses the array with a loose `VesselSchema` (all AIS fields
`string | number`), then:
- drops rows where `isValidPoint({ lat, lon })` is false;
- drops rows with neither IMO nor MMSI (after `"0"`-sentinel filtering);
- converts `speedKn = SPEED / 10`.

## `VaultVessel` field table

| Field | Type | Required | Source (MarineTraffic) | Notes |
|---|---|---|---|---|
| `id` | string | yes | derived | `vessel:imo-…` or `vessel:mmsi-…` |
| `imo` | string | no | `IMO` | `"0"` → absent |
| `mmsi` | string | no | `MMSI` | `"0"` → absent |
| `name` | string | no | `SHIPNAME` | |
| `vesselType` | string | no | `TYPE_NAME` ?? `SHIPTYPE` | |
| `flag` | string | no | `FLAG` | |
| `lat` | number | **yes** | `LAT` | gated by `isValidPoint` |
| `lon` | number | **yes** | `LON` | gated by `isValidPoint` |
| `speedKn` | number\|null | no | `SPEED / 10` | knots (API reports knots×10) |
| `courseDeg` | number\|null | no | `COURSE` | |
| `headingDeg` | number\|null | no | `HEADING` | |
| `navigationStatus` | string | no | `STATUS` | |
| `destination` | string | no | `DESTINATION` | |
| `eta` | string | no | `ETA` | |
| `lastContact` | string | **yes** | `TIMESTAMP` ?? now() | ISO |
| `provenance` | VaultProvenance[] | default [] | — | provider=marinetraffic |

## Example canonical record

```json
{
  "id": "vessel:imo-9743493",
  "imo": "9743493",
  "mmsi": "636092910",
  "name": "EVER GIVEN",
  "vesselType": "Container Ship",
  "flag": "PA",
  "lat": 30.02,
  "lon": 32.58,
  "speedKn": 8.3,
  "courseDeg": 178,
  "headingDeg": 176,
  "navigationStatus": "0",
  "destination": "ROTTERDAM",
  "eta": "08-25 06:00",
  "lastContact": "2026-08-20T09:41:00Z",
  "provenance": [{
    "provider": "marinetraffic", "dataset": "exportvessels",
    "providerRecordId": "636092910",
    "sourceUrl": "https://www.marinetraffic.com/",
    "license": "Property of Kpler / MarineTraffic (credential-gated)",
    "attribution": "MarineTraffic"
  }]
}
```
