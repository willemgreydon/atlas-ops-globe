# 04 — Cyber Schemas

Cyber normalizes to the canonical `VaultVulnerability` schema. Source payloads
validate against a provider-local Zod schema (CISA KEV JSON / NVD API 2.0 JSON),
then transform and validate against `VaultVulnerability`; malformed records are
skipped, never stored raw.

## `VaultVulnerability` (`lib/intel/schemas.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | CVE id, `cve:CVE-YYYY-NNNN` |
| `title` | string? | KEV name or truncated NVD description (≤300 chars) |
| `cvss` | number \| null? | NVD base score; null for KEV-only |
| `epss` | number \| null? | Not populated — always null |
| `cwe` | string[] | Defaults `[]`; e.g. `["CWE-79"]` |
| `vendor` | string? | Vendor project (KEV) |
| `products` | string[] | Defaults `[]` |
| `kev` | boolean | Defaults `false`; `true` for KEV records |
| `kevDateAdded` | string? | Date added to KEV catalogue |
| `publishedAt` | string? | NVD publication date |
| `updatedAt` | string? | NVD last-modified |
| `references` | string[] | Defaults `[]`; advisory URLs (NVD sliced to 8) |
| `source` | string | `"cisa-kev"` \| `"nvd"` |
| `provenance` | VaultProvenance[] | Defaults `[]` |

## Source schema highlights

- **CISA KEV** (`lib/intel/providers/cisa-kev.ts`): `{catalogVersion,
  vulnerabilities[]{cveID, vendorProject, product, vulnerabilityName, dateAdded,
  shortDescription, cwes[]}}` → `kev = true`, `cvss/epss = null`.
- **NVD** (`lib/intel/providers/nvd.ts`): `{vulnerabilities[].cve{id, published,
  lastModified, descriptions[], metrics{}, weaknesses[], references[]}}`. CVSS
  extracted from `cvssMetricV31`→`V30`→`V2` (first `baseScore`); CWE from
  `weaknesses[].description[].value` filtered to `CWE-*`.

## Validation approach

Both providers reject on Zod parse failure. Storage is via `upsertVulnerability`
— note the table column is `refs` (mapped from schema `references`), and `kev` is
persisted as `1`/`0`. Records upsert by CVE id, so KEV and NVD can enrich the
same row.

## Example canonical record (NVD)

```json
{
  "id": "cve:CVE-2026-5678",
  "title": "A cross-site scripting flaw in …",
  "cvss": 7.5, "epss": null,
  "cwe": ["CWE-79"],
  "products": [],
  "kev": false,
  "publishedAt": "2026-08-15T12:00:00.000",
  "updatedAt": "2026-08-16T09:00:00.000",
  "references": ["https://nvd.nist.gov/vuln/detail/CVE-2026-5678"],
  "source": "nvd",
  "provenance": [{ "provider": "nvd", "providerRecordId": "CVE-2026-5678",
    "retrievedAt": "2026-08-20T18:00:00Z" }]
}
```
