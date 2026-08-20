# 03 — Cyber Entities

The cyber domain's canonical entity is the **Vulnerability** (a `CyberEvent` in
the ontology), keyed by CVE id. It is non-spatial — no country, no lat/lon.

## Canonical entity types (from `lib/intel/ontology.ts`)

| Entity type | Role |
|---|---|
| `CyberEvent` | The ontology type for a vulnerability record |
| (`Company` / `Organization`) | Vendor context via `vendor`/`products` fields (not resolved to entity nodes yet) |

Vulnerabilities are stored in their own `vulnerabilities` table, **not** the
generic `entities`/`events` tables — cyber is deliberately kept out of the
spatial graph.

## Universal ID scheme (from `lib/intel/ids.ts`)

The CVE id is an authoritative universal identifier, so it is used directly as
the key:

| Helper | Format | Example |
|---|---|---|
| `IdOf.cve(id)` | `cve:<CVE-ID upper>` | `cve:CVE-2024-1234` |

`typeOfId("cve:CVE-2024-1234")` → `"cve"`.

## Key attributes (`VaultVulnerability` → `vulnerabilities` table)

| Attribute | Notes |
|---|---|
| `id` | `cve:CVE-YYYY-NNNN` |
| `title` | Vulnerability name (KEV) or truncated description (NVD) |
| `cvss` | Base score (NVD; null for KEV-only records) |
| `epss` | Exploit-prediction score — **not populated** (always null) |
| `cwe` | CWE ids, e.g. `["CWE-79"]` |
| `vendor` / `products` | Vendor project and affected product(s) (KEV) |
| `kev` | `true` if in the CISA KEV catalogue |
| `kevDateAdded` | Date added to KEV |
| `publishedAt` / `updatedAt` | NVD publication / last-modified |
| `references` | Advisory / detail URLs |
| `source` | `"cisa-kev"` or `"nvd"` |

## Example entity (KEV)

```json
{
  "id": "cve:CVE-2024-1234",
  "title": "Acme Router OS Command Injection",
  "cvss": null, "epss": null,
  "cwe": ["CWE-77"],
  "vendor": "Acme", "products": ["Router OS"],
  "kev": true, "kevDateAdded": "2026-08-01",
  "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-1234"],
  "source": "cisa-kev"
}
```
