# 14 — Cyber (Overview)

**Status: IMPLEMENTED · NON-SPATIAL**

## Mission

Defensive cyber situational awareness: which vulnerabilities are known to be
exploited in the wild (CISA KEV) and recent CVE metadata with CVSS/CWE (NVD).
Defensive only — no offensive tooling.

> **Discipline: cyber is NON-SPATIAL.** Vulnerabilities have no meaningful
> lat/lon. We do **not** fabricate geolocation for CVEs and they are **not**
> rendered as globe markers — cyber is surfaced as analysis (counts, KEV flags,
> severity), not a spatial layer.

## At a glance

| Property | Value |
|---|---|
| Sources | `cisa-kev` (Known Exploited Vulns JSON, ~1,671), `nvd` (CVE API 2.0 recent, ~100) |
| Ingestor | `lib/intel/domains/cyber.ts` (`ingestCyber`) |
| Providers | `lib/intel/providers/cisa-kev.ts`, `lib/intel/providers/nvd.ts` |
| Primary entity | Vulnerability / `CyberEvent` |
| Schema | `VaultVulnerability` (`lib/intel/schemas.ts`) |
| ID scheme | `IdOf.cve("CVE-2024-1234")` → `cve:CVE-2024-1234` |
| SQLite table written | `vulnerabilities` (+ `provenance`) |
| CLI | `pnpm intel:sync cyber` |
| API | `GET /api/intelligence/cyber` (`kev=1` for KEV only) |
| Approx count | ~1,771 total (~1,671 KEV + ~100 recent NVD) |

## How it works (short)

`ingestCyber` fetches the CISA KEV catalogue and the last 7 days of NVD CVEs in
parallel (`Promise.allSettled`), validates each against a source Zod schema, maps
to `VaultVulnerability`, and upserts into `vulnerabilities`. KEV entries set
`kev = true`; NVD supplies CVSS/CWE.

## Known limitations

- Not the full NVD corpus — only KEV + a recent NVD window. Older non-KEV CVEs
  are absent.
- EPSS scores and exploit-to-actor linkage are not populated.
- No spatial or country attribution (by design).

## Contents

- [02 — Sources](../02-sources/README.md)
- [03 — Entities](../03-entities/README.md)
- [04 — Schemas](../04-schemas/README.md)
- [05 — Pipeline](../05-pipeline/README.md)
- [06 — Relationships](../06-relationships/README.md)
- [07 — Analysis & Gaps](../07-analysis-and-gaps/README.md)
