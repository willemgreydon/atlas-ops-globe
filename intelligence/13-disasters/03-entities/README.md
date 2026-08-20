# 03 — Disasters Entities

The disasters domain produces `DisasterEvent` records (stored as `events` with
`kind = "disaster"`) and links them to the global `Country` entity.

## Canonical entity types (from `lib/intel/ontology.ts`)

| Entity type | Role |
|---|---|
| `DisasterEvent` / `Event` | Earthquake or natural event; the primary record |
| `Country` | Resolution target (owned by the global domain) |

## Universal ID scheme (from `lib/intel/ids.ts`)

Disaster events use provider-scoped event ids. The provider builds the id at
fetch time (`event:<provider>:<providerId>`); `IdOf` also exposes matching
helpers:

| Helper | Format | Example |
|---|---|---|
| `IdOf.event(provider, providerId)` | `event:<provider>:<id>` | `event:usgs:us7000abcd` |
| `IdOf.disaster(provider, providerId)` | `disaster:<provider>:<id>` | `disaster:usgs:us7000abcd` |
| `IdOf.country(iso2)` | `country:<ISO2>` | `country:JP` |

In practice the USGS/EONET providers emit `event:usgs:<id>` and
`event:eonet:<id>` directly (see `lib/providers/usgs.ts`, `eonet.ts`).

## Key attributes (`VaultEvent` → `events` table)

| Attribute | Notes |
|---|---|
| `id` | `event:<provider>:<providerId>` |
| `kind` | Always `"disaster"` for this domain |
| `subtype` | First tag (e.g. category / `earthquake`) |
| `title` | Human-readable title (e.g. "M 6.1 - 20km …") |
| `severity` | `info`/`watch`/`warning`/`critical` (from magnitude for USGS) |
| `occurredAt` | ISO timestamp |
| `lat` / `lon` | Event location |
| `countryCode` | Reported or nearest-centroid ISO2 |
| `source` / `sourceUrl` | "USGS" / "NASA EONET" + detail URL |
| `confidence` | Provider reliability × geo precision |
| `tags` | e.g. `["earthquake","M6.1"]` or EONET category titles |

## Example entity (earthquake)

```json
{
  "id": "event:usgs:us7000abcd",
  "kind": "disaster",
  "subtype": "earthquake",
  "title": "M 6.1 - 20 km SW of Town",
  "severity": "critical",
  "occurredAt": "2026-08-20T09:12:00.000Z",
  "lat": 38.2, "lon": 141.9,
  "countryCode": "JP",
  "source": "USGS",
  "tags": ["earthquake", "M6.1"]
}
```
