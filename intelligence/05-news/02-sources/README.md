# 05 · News — Sources

One row of `lib/intel/sources.ts` feeds this domain today, plus one planned
enrichment source.

## GDELT DOC 2.0 — IMPLEMENTED

| Field | Value |
|---|---|
| id | `gdelt` |
| name | GDELT DOC 2.0 |
| baseUrl | `https://api.gdeltproject.org/api/v2/doc/doc` |
| type | `api` |
| auth | `none` (no key) |
| domains | `news`, `global` |
| status | `implemented` · `enabled: true` |
| license | GDELT terms; **links/metadata only** |
| commercialUse | `review-required` |
| redistribution | `restricted` |
| attribution | **required** — "The GDELT Project" |
| polling | `true` |

### Acquisition (rate limits & TTL)

| Setting | Value | Notes |
|---|---|---|
| minIntervalSec | 6 | ~1 req / 5s ceiling; we pace at 6s |
| concurrency | 1 | serialize to avoid rejection |
| cacheTtlSec | 120 | ingestion-layer cache |
| maxRetries | 3 | |

### Format & failure mode

JSON (`format=json`, `mode=ArtList`). **Critical quirk:** GDELT returns
**HTTP 200 with a plain-text body** when it rate-limits or rejects a query.
`fetchGdeltText()` reads `res.text()` first and, if the trimmed body does not
start with `{` or `[`, throws `gdelt rejected request: <first 80 chars>` rather
than mis-parsing. A 20s abort timeout guards hangs.

### Coverage

Global, multilingual article discovery. Each record carries `url`, `title`,
`seendate` (`YYYYMMDDTHHMMSSZ` → normalized to ISO-8601), `domain` (publisher),
`language`, `sourcecountry`. We fetch `maxrecords=50`, `sort=DateDesc`. Default
query: `conflict OR diplomacy OR sanctions OR disaster` (overridable via
`--query`).

### Sample URL

```
https://api.gdeltproject.org/api/v2/doc/doc?query=sanctions&mode=ArtList&maxrecords=50&format=json&sort=DateDesc
```

### Licensing discipline

Store the **link and metadata only** — never article body text. Attribution
"The GDELT Project" is emitted on every record's provenance and on the API
response (`attribution` field).

## Wikidata — PLANNED (person/org enrichment)

| Field | Value |
|---|---|
| id | `wikidata` · status `next` · `enabled: false` |
| baseUrl | `https://www.wikidata.org/w/api.php` |
| auth | `none` · license `CC0` (commercial/redistribution allowed) |
| acquisition | minIntervalSec 2, cacheTtlSec 604800 (7d) |
| purpose | Resolve `persons[]`/`organizations[]` NER — adapter interface present, not wired |

**Priority: High** — it is free (CC0) and unlocks the empty person/org arrays.
