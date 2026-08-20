# 05 — Cyber Pipeline

## Flow (`lib/intel/domains/cyber.ts`)

```
cisa-kev (known_exploited_vulnerabilities.json) + nvd (cves/2.0, last 7 days)
  → fetch      (Promise.allSettled — one failing provider does not sink the other)
  → validate   (provider Zod schema)
  → normalize  (→ VaultVulnerability; KEV sets kev=true, NVD supplies cvss/cwe)
  → store      (upsertVulnerability → vulnerabilities + provenance)
```

No geolocation, no country resolution, no relationship edges — cyber is
**non-spatial** by design. KEV records are counted as `created`; NVD records as
`updated` in the ingest report.

## CLI

```
pnpm intel:sync cyber     # this domain
pnpm intel:sync --all     # all domains
pnpm intel:update         # incremental refresh (cyber included)
```

## Cadence / TTL

| Source | minIntervalSec | cacheTtlSec |
|---|---|---|
| cisa-kev | 60 | 21,600 (6h) |
| nvd | 6 | 3,600 (1h) |

NVD fetches a fixed 7-day publication window per run.

## SQLite table written (real columns)

`vulnerabilities` (PK `id`):

```
id, title, cvss, epss, cwe, vendor, products, kev, kev_date_added,
published_at, updated_at, refs, source, provenance
```
Indexes: `idx_vuln_kev` (on `kev`), `idx_vuln_published` (on `published_at`).
Note: schema `references` → column `refs`; `kev` stored as `1`/`0`; JSON arrays
(`cwe`, `products`, `refs`, `provenance`) serialized as TEXT.

`provenance`: one row per CVE (`provider`, `providerRecordId`, `sourceUrl`,
`rawHash`, `retrievedAt`, …).

## Provenance & retention

- KEV records reference the CISA catalogue URL; NVD records reference
  `https://nvd.nist.gov/vuln/detail/<cve>`. Each carries a raw payload hash.
- Records upsert by CVE id, so a CVE present in both KEV and NVD is enriched into
  a single row across runs (`kev` flag + `cvss`/`cwe`).
- DB is gitignored — retention is local and ephemeral; the KEV catalogue is a
  full snapshot each fetch, NVD is a rolling 7-day window.
