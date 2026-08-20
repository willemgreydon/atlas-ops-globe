# 02 · Conflict — Analysis & Gaps

**Status: PLANNED.** No conflict data exists yet, so the queries below are the
*intended* reads (the `events` table and query layer are IMPLEMENTED and would
serve them once a source is wired).

## Derived metrics (target)

- **Event volume by country / period** — hotspots over a rolling window.
- **Severity mix** — distribution of `info|watch|warning|critical`.
- **Event-type breakdown** — via `subtype` / `tags` (neutral categories only).
- **Source agreement** — when multiple sources report the same event, treat as
  corroboration; track lineage rather than assert consensus.

## Example SQL (target — table exists today)

Conflict events by country, last 30 days:

```sql
SELECT country_code, COUNT(*) AS n
FROM events
WHERE kind = 'conflict' AND occurred_at >= datetime('now','-30 day')
GROUP BY country_code ORDER BY n DESC;
```

Severity distribution:

```sql
SELECT severity, COUNT(*) AS n
FROM events WHERE kind = 'conflict'
GROUP BY severity;
```

## Example API queries (target)

```
GET /api/intelligence/events?kind=conflict&country=SY&since=30d
GET /api/intelligence/events?kind=conflict&bbox=<w,s,e,n>&since=7d
```
`listEvents` (`lib/intel/queries.ts`) already supports `kind`, `country`,
`since` and `bbox` filters — it will serve conflict rows the moment they exist.

## Gaps & limitations

| Gap | Impact | Status |
|---|---|---|
| No wired source | zero conflict coverage today | SCAFFOLDED |
| ACLED blocked | richest dataset unavailable | CREDENTIAL_REQUIRED (OAuth) |
| No actor NER | actors stay as tags, not entities | PLANNED (Wikidata) |
| UCDP/UN | historical/fatality series unmodelled | RESEARCH |
| No `domains/conflict.ts` | ingestor not implemented | PLANNED |

## Data-quality & ethics discipline

- **Neutral analytical labelling** — event and actor descriptions stay factual
  and non-partisan.
- **Never infer casualties from ambiguous reporting** — magnitude/severity
  reflect only verifiable, reported figures.
- **Never convert rumours to facts** — unconfirmed claims are not stored as
  events; ambiguous attribution is left unresolved.
- **Basis + confidence are always explicit** — `spatially-near` geocodes and any
  low-confidence link are labelled, never dressed up as `direct`/`reported`.
- **Provenance on every record** — source, license and attribution are auditable;
  redistribution-restricted sources (ACLED) are honoured.

## Recommended path to first data

1. Wire **ReliefWeb** (free, `next`) → first honest coverage.
2. Integrate **GDELT events** on the existing account.
3. Add **ACLED** once OAuth credentials are provisioned.
4. Evaluate **UCDP/UN** after license review.
