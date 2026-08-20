# 02 — Global Sources

Global's own seed source is Natural Earth. The aggregate snapshot additionally
*reads* every implemented domain source; those are documented under each domain.
Below is the full dossier for the seed source and the read-through list.

## Natural Earth — `naturalearth`

| Field | Value |
|---|---|
| Name / id | Natural Earth / `naturalearth` |
| Domains | `global` |
| Type | `bulk` (bundled seed, offline) |
| baseUrl | `https://www.naturalearthdata.com/` |
| Auth | `none` |
| Polling | no |
| minIntervalSec | 5 |
| cacheTtlSec | 31,536,000 (1 year) |
| concurrency | 2 |
| maxRetries | 3 |
| License | Public domain |
| commercialUse | allowed |
| redistribution | allowed |
| attributionRequired | false |
| Data format | Bundled centroid data (`ne_110m_admin_0_countries`) |
| Coverage | Global; ~175 countries with ISO2 codes |
| History depth | Static reference (no time series) |
| **Status** | **IMPLEMENTED** |
| Priority | — (already live) |

**Notes:** Seed country geometry/centroids are bundled with the repo; the seed
runs offline. Territories without ISO2 codes (Northern Cyprus, Somaliland) are
skipped.

## Sources read into the aggregate snapshot

`buildGlobalSnapshot()` records this source list in the snapshot's `sources`
field and reads the tables they populate:

| Source id | Domain(s) | Status | Feeds table(s) read by Global |
|---|---|---|---|
| `naturalearth` | global | IMPLEMENTED | `countries` |
| `gdelt` | news, global | IMPLEMENTED | `news_articles`, `news_stories` |
| `usgs` | disasters | IMPLEMENTED | `events` |
| `eonet` | disasters, environment | IMPLEMENTED | `events` |
| `worldbank` | economics | IMPLEMENTED | `economic_observations` |
| `cisa-kev` | cyber | IMPLEMENTED | `vulnerabilities` |
| `nvd` | cyber | IMPLEMENTED | `vulnerabilities` |
| `celestrak` | space | IMPLEMENTED | `space_objects` |
| `opensky` | aviation | IMPLEMENTED | `aircraft` |

`markets` and `maritime` have **no wired source** and are reported as `null`.

### Sample "request"

There is no network request — the seed reads bundled data. The snapshot itself
is produced by:

```
pnpm intel:sync countries   # seed countries
pnpm intel:index            # (re)build snapshots/latest.json
```
