# Legal & Operational Notes

A globe like this is mostly a data-licensing and reliability project, not a
rendering project. The hard problems are: *may we use this data?*, *is it fresh
and honest?*, and *can we degrade gracefully when a source fails?* This page
collects the responsible-acquisition principles and operational discipline that
govern both the globe and the [Intelligence Vault](../08-intelligence/README.md).

## Responsible acquisition

Only public/open sources are integrated, and always through the least-intrusive
access method available. The preference order is:

1. **Official API** — a documented, first-party endpoint (OpenSky, USGS, EONET,
   GDELT DOC, World Bank, NVD, CISA, CelesTrak). Always preferred.
2. **Bulk / file downloads** — official datasets meant for download
   (Natural Earth centroids, OFAC list, OurAirports CSV). Cache and refresh on a
   courtesy cadence.
3. **RSS / feeds** — where a provider publishes a feed for exactly this purpose.
4. **Licensed sources** — commercial APIs used only under an obtained licence
   (e.g. AISstream, ACLED — both credential-gated and not wired without terms).
5. **Permitted public pages** — only as a last resort, only where the site's
   terms and `robots.txt` allow it.

Non-negotiable rules across all of the above:

- **Respect `robots.txt` and rate limits.** Each source in `lib/intel/sources.ts`
  carries its own `acquisition` config — `minIntervalSec`, `cacheTtlSec` and
  `concurrency` — chosen against the provider's stated or courtesy limits. GDELT,
  for example, is throttled to ~1 req/5s (min interval 6s) because it enforces
  that and returns plain text on rejection.
- **No bypassing authentication, CAPTCHAs or paywalls.** If a source requires a
  credential we do not have, it stays `credential-required` and is not ingested —
  never worked around.
- **Public-source only.** No private-person tracking, no scraping behind logins.
  Public-person entity enrichment (planned via Wikidata) must use public
  information and reputable sources, and keep provenance.
- **No fabricated functionality or claims** (ADR-011). Planned layers/modes are
  visibly disabled and labelled; the ticker shows only real signals; no entity is
  labelled with charged terms absent an authoritative public source with visible
  provenance.

## Honest status, not implied certainty

The system is built to be honest about liveness rather than to imply total
coverage.

- Every payload carries a `DataStatus` — **LIVE / DELAYED / CACHED / MOCK /
  OFFLINE**. Mock or cached data is never presented as live. A source that is not
  configured is served as `OFFLINE` mock, not silently faked.
- Sanctions data is treated as **source data, not a legal conclusion**: display
  the list, program, authority and retrieval time; never collapse multiple
  authorities into a single unsupported "sanctioned = yes" flag.
- Conflict and breaking-news events can be wrong or incomplete. Show source,
  freshness and confidence; the confidence engine is **computed and explainable**
  (`scoreConfidence`), never a hardcoded UI percentage.
- Derived indicators (e.g. "dark vessels" / loss of expected AIS) are labelled as
  *analytic indicators*, not proof of wrongdoing.
- Relationship edges carry a `basis` (`direct` / `reported` / `spatially-near` /
  …) so inferred links are never shown as facts.

## Licensing awareness

**Publicly accessible ≠ freely redistributable.** An API being open,
unauthenticated or free of charge says nothing about whether we may use its data
commercially or re-serve it. Each source's licensing posture — `commercialUse`,
`redistribution`, required `attribution` and `status` — is encoded as structured
fields in the provider registry (`data/provider-registry.ts` for the globe,
`lib/intel/sources.ts` for the vault). See
[`05-licensing/`](../05-licensing/README.md) for the full table and the required
attribution strings, and render those credits wherever the corresponding source's
data is displayed.

Notable caveats:

- **GDELT** — links and metadata only; do **not** republish full article text or
  store article bodies. Redistribution restricted.
- **OpenSky** — non-commercial / research terms; commercial deployment needs a
  separate licence.
- **CelesTrak**, **ReliefWeb**, **Open-Meteo** — review-required for
  commercial/redistribution.
- **ACLED**, **AISstream** — restricted and credential-gated; confirm current
  terms and obtain a licence/key before enabling. Per-workspace **entitlement
  gating** to enforce these fields is on the hardening backlog
  ([`04-security/`](../04-security/README.md)).

## Operational cadence & retention

- **Per-source cadence.** Each provider has its own cache TTL and client/ingestion
  poll interval, set to respect both freshness and courtesy limits (e.g. aircraft
  10s TTL, USGS 60s, EONET 5m, GDELT 2m, World Bank 24h). The globe polls a feed
  only while its backing layer is enabled — an off layer generates zero upstream
  traffic.
- **Stale-while-error.** On upstream failure the framework serves the last good
  cached value (labelled `CACHED`) or an honest `MOCK`, and never throws a 500.
  Failures degrade rather than break.
- **Retention is deliberately thin and ephemeral.** The vault's SQLite DB
  (`data/intelligence.db`), raw provider snapshots and generated indexes are
  gitignored; coverage counts are only as fresh as the last local sync. The
  OpenSky aircraft snapshot is on-demand and snapshot-only (latest position per
  aircraft, not committed). Sensitive live asset locations should be delayed or
  aggregated where provider terms, security policy or law require it.
- **Source-health monitoring** is the operational backbone to build out: API
  latency, last successful ingest, gap detection, quota usage, schema drift and
  token expiry. Structured JSON logging (`lib/core/logger.ts`) and `/api/health`
  (per-provider configured/credential state) are the current substrate.
