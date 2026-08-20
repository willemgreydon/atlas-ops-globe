# 04 — Global Schemas

Global owns `VaultCountry` (seed) and consumes the `GlobalSnapshot` shape
produced by `buildGlobalSnapshot()`. External payloads validate against a source
schema in each provider, then transform and validate against these canonical Zod
schemas before storage; malformed records are logged and skipped, never stored.

## `VaultCountry` (`lib/intel/schemas.ts`)

| Field | Type | Notes |
|---|---|---|
| `iso2` | string | Primary key |
| `iso3` | string | 3-letter ISO |
| `name` | string | Country name |
| `region` | string? | Optional region |
| `capital` | string? | Optional capital |
| `lat` | number? | Centroid latitude |
| `lon` | number? | Centroid longitude |
| `data` | record | Defaults to `{}` |
| `provenance` | VaultProvenance[] | Defaults to `[]` |

## `GlobalSnapshot` (`lib/intel/global.ts`, not a Zod schema — a TS interface)

| Field | Type | Notes |
|---|---|---|
| `generatedAt` | string (ISO) | Snapshot build time |
| `activeDisasters` | number | `count(events, kind='disaster')` |
| `earthquakes24h` | number | events tagged `earthquake` in last 24h |
| `majorStories` | array | Top news stories with `articleCount > 1` |
| `criticalAlerts` | array | Events with severity `critical`/`warning`, newest 8 |
| `counts` | object | Per-table counts (see below) |
| `markets` | null | No feed wired — explicitly unavailable |
| `maritime` | null | No AIS provider wired |
| `sources` | string[] | Source ids contributing to the snapshot |

`counts` fields: `countries`, `newsArticles`, `newsStories`, `events`,
`vulnerabilities`, `kev`, `spaceObjects`, `aircraftSnapshot`, `relationships`.

## Validation approach

`VaultCountry` is validated with Zod before `upsertCountry`. The snapshot is
derived purely from SQLite aggregate reads — every metric is grounded in stored
rows, and unavailable domains are `null`.

## Example snapshot record

```json
{
  "generatedAt": "2026-08-20T18:00:00.000Z",
  "activeDisasters": 123,
  "earthquakes24h": 14,
  "majorStories": [{ "id": "story:abc", "title": "…", "articleCount": 12 }],
  "criticalAlerts": [{ "id": "event:usgs:us70001", "title": "M6.1 …",
    "severity": "critical", "occurredAt": "2026-08-20T09:12:00Z" }],
  "counts": {
    "countries": 175, "newsArticles": 0, "newsStories": 0, "events": 123,
    "vulnerabilities": 1771, "kev": 1671, "spaceObjects": 2000,
    "aircraftSnapshot": 0, "relationships": 123
  },
  "markets": null,
  "maritime": null,
  "sources": ["naturalearth","gdelt","usgs","eonet","worldbank","cisa-kev","nvd","celestrak","opensky"]
}
```
