# cyber

**Status: Implemented**

## Purpose
Defensive cyber situational awareness: which vulnerabilities are known exploited
in the wild, and recent CVE metadata. Defensive only — no offensive tooling.

## Current sources
- **CISA KEV** (`cisa-kev`) — Known Exploited Vulnerabilities catalogue
  (~1671 entries, `kev = 1`).
- **NVD CVE API 2.0** (`nvd`) — recent CVEs with CVSS/CWE (~100). Total ~1771.

## Canonical entities
- `CyberEvent` / vulnerability records (see `VaultVulnerability`).

## Update frequency
- Polling. KEV min interval 60s (cache 6h); NVD min interval 6s (cache 1h).
  Included in `pnpm intel:update`.

## Storage
- `vulnerabilities` table (indexed on `kev`, `published_at`); `provenance` rows.
  IDs via `IdOf.cve(id)`.

## Known limitations
- Not the full NVD corpus — only KEV + a recent NVD window. Older non-KEV CVEs
  are absent.
- EPSS/exploit-to-actor linkage not populated.

## Licensing considerations
- US Gov open data — commercial use and redistribution allowed; attribution
  required ("CISA", "NVD / NIST").

## Next sources
- Broader NVD backfill; EPSS scores; vendor advisories.
