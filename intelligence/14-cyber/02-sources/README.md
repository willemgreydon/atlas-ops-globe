# 02 — Cyber Sources

Two live, zero-credential sources feed cyber. NVD optionally accepts an API key
for higher rate limits.

## CISA Known Exploited Vulnerabilities — `cisa-kev`

| Field | Value |
|---|---|
| Name / id | CISA Known Exploited Vulnerabilities / `cisa-kev` |
| Domains | `cyber` |
| Type | `file` (polling) |
| baseUrl / endpoint | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` |
| Auth | `none` |
| minIntervalSec | 60 |
| cacheTtlSec | 21,600 (6h) |
| concurrency | 2 · maxRetries 3 |
| License | US Government open data |
| commercialUse / redistribution | allowed / allowed |
| attribution | required — "CISA" |
| Data format | JSON file (`catalogVersion`, `vulnerabilities[]`) |
| Coverage | Vulnerabilities known exploited in the wild (~1,671) |
| History depth | Full catalogue snapshot each fetch |
| **Status** | **IMPLEMENTED** |
| Priority | — (live) |

**Sample request**

```
GET https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
```

Each record: `cveID`, `vendorProject`, `product`, `vulnerabilityName`,
`dateAdded`, `shortDescription`, `cwes[]`. Mapped with `kev = true` and a
back-reference to `https://nvd.nist.gov/vuln/detail/<cve>`.

## NVD CVE API 2.0 — `nvd`

| Field | Value |
|---|---|
| Name / id | NVD CVE API 2.0 / `nvd` |
| Domains | `cyber` |
| Type | `api` (polling) |
| baseUrl / endpoint | `https://services.nvd.nist.gov/rest/json/cves/2.0` |
| Auth | `optional` — `NVD_API_KEY` |
| minIntervalSec | 6 |
| cacheTtlSec | 3,600 (1h) |
| concurrency | 1 · maxRetries 3 |
| License | US Government open data |
| commercialUse / redistribution | allowed / allowed |
| attribution | required — "NVD / NIST" |
| Data format | JSON (`vulnerabilities[].cve{…}`) |
| Coverage | Recent CVEs by publication window (default last 7 days, ~100) |
| History depth | `pubStartDate`/`pubEndDate` window (7d here); one page of 100 |
| **Status** | **IMPLEMENTED** |
| Priority | — (live) |

**Sample request**

```
GET https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=2026-08-13T00:00:00.000&pubEndDate=2026-08-20T00:00:00.000&resultsPerPage=100
```

Anonymous limit ~5 req/30s (hence 6s interval); higher with `NVD_API_KEY` sent
as the `apiKey` header. NVD dates use `YYYY-MM-DDTHH:MM:SS.SSS` (no trailing Z).
Supplies CVSS (v3.1/v3.0/v2 base score) and CWE ids; `kev = false`.
