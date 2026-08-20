# 07 — Cyber Analysis & Gaps

Cyber is surfaced as **analysis**, not spatial markers. Metrics flow into the
global snapshot and the `/api/intelligence/cyber` endpoint.

## Derived metrics / aggregates

From `buildGlobalSnapshot()` (`lib/intel/global.ts`):

- `vulnerabilities` = `COUNT(*) FROM vulnerabilities`
- `kev` = `COUNT(*) FROM vulnerabilities WHERE kev = 1`

## Example SQL

```sql
-- KEV vs total
SELECT COUNT(*) AS total,
       SUM(CASE WHEN kev=1 THEN 1 ELSE 0 END) AS kev
FROM vulnerabilities;

-- Recently-added KEV entries
SELECT id, title, vendor, kev_date_added FROM vulnerabilities
WHERE kev=1 ORDER BY kev_date_added DESC LIMIT 20;

-- High-severity recent NVD CVEs
SELECT id, title, cvss, published_at FROM vulnerabilities
WHERE cvss >= 9.0 ORDER BY published_at DESC;

-- CWE frequency (JSON array in `cwe`)
SELECT source, COUNT(*) FROM vulnerabilities GROUP BY source;
```

## API queries

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/intelligence/cyber` | `kev` (`1`/`true` = KEV only), `since`, `limit`, `cursor` | Paginated vulnerabilities; adds `attribution: "CISA KEV / NVD"` |
| `GET /api/intelligence/global` | — | Snapshot incl. `counts.vulnerabilities`, `counts.kev` |
| `GET /api/intelligence/stats` | — | Per-table counts incl. `vulnerabilities` |

`since` accepts `24h`/`7d`/`60m` (against `published_at`). There is **no**
`bbox`/`country` filter — cyber is non-spatial.

## Coverage gaps / blind spots

- **Not the full NVD corpus** — only the CISA KEV catalogue (~1,671) plus the
  last 7 days of NVD CVEs (~100). Older, non-KEV CVEs are absent.
- **EPSS not populated** — the `epss` field is always null; no exploit-prediction
  scoring.
- **CVSS gaps** — KEV-only records have `cvss = null` until the same CVE appears
  in the NVD window.
- **No exploit-to-actor linkage**, no threat-actor or campaign attribution, no
  vendor entity resolution.
- **No geolocation** — intentional; cyber is not a globe layer.

## Data quality / freshness

- KEV is authoritative for exploited-in-the-wild status; NVD is authoritative for
  CVSS/CWE. Records upsert by CVE id so both enrich one row.
- Each record carries a provenance row with a raw payload hash.
- Counts (~1,771) are as fresh as the last `pnpm intel:sync cyber`; the DB is
  gitignored. KEV is a full snapshot each run; NVD is a rolling 7-day window.
