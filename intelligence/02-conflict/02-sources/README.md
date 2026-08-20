# 02 · Conflict — Sources

All conflict sources are **planned or blocked** — none is wired. Rows below come
from `lib/intel/sources.ts` (or are RESEARCH-stage candidates not yet in the
registry).

## ReliefWeb — PLANNED (wire first)

| Field | Value |
|---|---|
| id | `reliefweb` · status `next` · `enabled: false` |
| baseUrl | `https://api.reliefweb.int/v1/` |
| type | `api` · auth `none` |
| domains | `disasters`, `conflict` |
| license | OCHA terms · commercial `review-required` · redistribution `review-required` |
| attribution | required — "OCHA ReliefWeb" |
| envKeys | `RELIEFWEB_APPNAME` (identify your app) |
| acquisition | cacheTtlSec 3600 (1h), polling |

Free, no credential — the cheapest first wire-up. Provides humanitarian
situation reports and disaster/conflict context.

## ACLED — CREDENTIAL_REQUIRED (blocked)

| Field | Value |
|---|---|
| id | `acled` · status `credential-required` · `enabled: false` |
| baseUrl | `https://api.acleddata.com/` |
| type | `api` · auth `oauth` |
| domains | `conflict` |
| license | ACLED licence · commercial `restricted` · redistribution `restricted` |
| attribution | required — "ACLED" |
| envKeys | `ACLED_CLIENT_ID`, `ACLED_CLIENT_SECRET` |
| acquisition | cacheTtlSec 3600 (1h), polling |

The authoritative structured conflict-event dataset (event date, type, actors,
location, notes). Blocked on OAuth credentials; redistribution is restricted, so
the vault would store derived/attributed events under ACLED terms.

## GDELT events — PLANNED (endpoint not integrated)

The already-wired `gdelt` account (see 05-news) also exposes event/GEG feeds.
These are **not yet integrated** for conflict. Same acquisition posture as DOC
2.0 (minInterval 6s, concurrency 1, metadata/links only, plain-text rejection
handling).

## UCDP / UN — RESEARCH

Uppsala Conflict Data Program and UN datasets are RESEARCH-stage: not in the
registry, license and modelling under review. Candidate for authoritative
historical/fatality series once terms and neutral-labelling rules are settled.

## Sample URL (ReliefWeb, illustrative)

```
https://api.reliefweb.int/v1/reports?appname=<RELIEFWEB_APPNAME>&filter[field]=primary_country&limit=50
```

## Priority

1. **ReliefWeb** (free, `next`) — wire first for humanitarian/context coverage.
2. **ACLED** — highest structured value, but blocked on credentials.
3. **GDELT events** — integrate the events endpoint on the existing account.
4. **UCDP/UN** — after license review.
