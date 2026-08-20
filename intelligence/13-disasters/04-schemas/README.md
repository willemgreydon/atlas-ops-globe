# 04 — Disasters Schemas

Disasters normalize to the canonical `VaultEvent` schema. Source payloads are
first validated against a provider-local Zod schema (USGS GeoJSON / EONET JSON),
then transformed and validated against `VaultEvent`; malformed records are
skipped, never stored raw.

## `VaultEvent` (`lib/intel/schemas.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `event:<provider>:<providerId>` |
| `kind` | string | `"disaster"` |
| `subtype` | string? | First tag / category |
| `title` | string | Event title |
| `summary` | string? | Optional description |
| `severity` | enum | `info` \| `watch` \| `warning` \| `critical` |
| `occurredAt` | string (ISO) | Event time |
| `publishedAt` | string? | Optional |
| `lat` | number? | Latitude |
| `lon` | number? | Longitude |
| `countryCode` | string? | Reported or nearest-centroid ISO2 |
| `source` | string | "USGS" / "NASA EONET" |
| `sourceUrl` | string? | Detail URL |
| `confidence` | number? | 0–1, provider reliability × geo precision |
| `tags` | string[] | Defaults `[]` |
| `provenance` | VaultProvenance[] | Defaults `[]` |

## Source schema highlights

- **USGS** (`lib/providers/usgs.ts`): `features[].{id, properties{title, time,
  mag, url}, geometry{coordinates:[lon,lat,depthKm]}}`. `time` (epoch ms) →
  ISO; severity from `mag`.
- **EONET** (`lib/providers/eonet.ts`): `events[].{id, title, categories[],
  geometry[]{date,coordinates}, sources[]{id,url}}`. Uses the last geometry
  point; severity fixed to `watch`.

## Validation approach

Invalid geometry is filtered with `isValidPoint`. Both providers reject on Zod
parse failure. Confidence is computed via `scoreConfidence({sourceCount,
providerReliability, geoPrecision})` — USGS geo precision 0.9, EONET 0.7.

## Example canonical record

```json
{
  "id": "event:eonet:EONET_6543",
  "kind": "disaster",
  "subtype": "Wildfires",
  "title": "Wildfire - Northern Region",
  "severity": "watch",
  "occurredAt": "2026-08-19T00:00:00Z",
  "lat": -33.5, "lon": 150.2,
  "countryCode": "AU",
  "source": "NASA EONET",
  "sourceUrl": "https://…",
  "confidence": 0.63,
  "tags": ["Wildfires"],
  "provenance": [{ "provider": "eonet", "providerRecordId": "EONET_6543",
    "retrievedAt": "2026-08-20T18:00:00Z" }]
}
```
