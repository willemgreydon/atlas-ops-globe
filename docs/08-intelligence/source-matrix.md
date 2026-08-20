# Intelligence Vault — Source Matrix

Master acquisition map. One row per source in `lib/intel/sources.ts`. This is
the single table for deciding what to wire next and what each source costs.

Columns:
- **LIVE?** — Yes = wired ingestor running today; No = registry/adapter only.
- **AUTH** — from the source `auth` field.
- **COST** — `free` (zero credential) or `credential` (needs key/OAuth).
- **STATUS** — `implemented | next | credential-required` (registry field).
- **PRIORITY** — acquisition priority given value and blockers.

| DOMAIN | SOURCE | TYPE | LIVE? | AUTH | COST | LICENSE | STATUS | PRIORITY |
|---|---|---|---|---|---|---|---|---|
| global | naturalearth | bulk | Yes | none | free | Public domain | implemented | — |
| news, global | gdelt | api | Yes | none | free | GDELT terms (metadata/link only) | implemented | — |
| disasters | usgs | api | Yes | none | free | US Gov open data | implemented | — |
| disasters, environment | eonet | api | Yes | none | free | NASA open data | implemented | — |
| economics | worldbank | api | Yes | none | free | CC BY 4.0 | implemented | — |
| cyber | cisa-kev | file | Yes | none | free | US Gov open data | implemented | — |
| cyber | nvd | api | Yes | optional | free (key optional) | US Gov open data | implemented | — |
| space | celestrak | api | Yes | none | free | CelesTrak terms | implemented | — |
| aviation | opensky | api | Yes | optional | free (key optional) | OpenSky non-commercial/research | implemented | — |
| politics, news | wikidata | api | No | none | free | CC0 | next | **High** — unlocks person/org NER |
| disasters, conflict | reliefweb | api | No | none | free | OCHA terms | next | Medium — humanitarian context |
| conflict | acled | api | No | oauth | credential | ACLED licence | credential-required | Medium — blocked on credential |
| maritime | aisstream | api | No | api-key | credential | AISstream terms | credential-required | Medium — blocked on credential |
| aviation, infrastructure | ourairports | bulk | No | none | free | Public domain | next | Medium — airport reference seed |
| weather, environment | openmeteo | api | No | none | free | CC BY 4.0 | next | Medium — weather backbone |
| sanctions | ofac | bulk | No | none | free | US Gov open data | next | **High** — free, high-value, unwired |

## Quick reads

- **9 live sources**, all zero-credential (two accept an optional key for higher limits: `nvd`, `opensky`).
- **7 planned/blocked sources.** Five are free (`wikidata`, `reliefweb`, `ourairports`, `openmeteo`, `ofac`); two need credentials (`acled`, `aisstream`).
- **Free, unwired, high value:** `wikidata` (entity NER), `ofac` (sanctions). These are the cheapest wins.
- **Credential-gated:** `acled` (conflict), `aisstream` (maritime) — the only two sources that cannot go live without an account.
- **License caution:** `gdelt` (metadata/links only, restricted redistribution), `celestrak` (review-required), `opensky` (non-commercial/research), `acled`/`aisstream` (restricted).
