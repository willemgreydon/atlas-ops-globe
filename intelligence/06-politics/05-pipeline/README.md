# Politics — Pipeline (Planned)

**No politics ingestor is registered** in `lib/intel/registry.ts`
(`INGESTORS`). `pnpm intel:sync politics` therefore prints
`! unknown domain: politics` today. The stages below describe intended behavior.

## Intended stages

Follows the vault pipeline (`intelligence/README.md`):
`SOURCE → NORMALIZED → ENRICHED → RELATIONSHIPS → PRODUCTS`.

1. **SOURCE** — fetch from Wikidata (`wbgetentities` / SPARQL) for a watchlist
   of QIDs (heads of state/gov, cabinets, parliaments, parties). Respect the
   registry acquisition: `minIntervalSec: 2`, `cacheTtlSec: 604800`.
2. **NORMALIZED** — validate raw payload against a per-provider source schema,
   transform to `VaultEntity` (persons/orgs) and `VaultEvent` (elections).
3. **ENRICHED** — mint IDs via `IdOf.person` / `IdOf.org` (QID-keyed), resolve
   `country_code` from Wikidata P17/P27; increment `mention_count` from news.
4. **RELATIONSHIPS** — build **time-valid** edges from position-held qualifiers
   (P39/P580/P582): `HEAD_OF`, `MEMBER_OF`, `GOVERNS` with `validFrom`/`validTo`.
5. **PRODUCTS** — enrich country profiles (`/api/intelligence/countries/[code]`)
   with head of state/gov + next election; feed news person/org NER.

## CLI (planned)

```
pnpm intel:sync politics      # once an ingestor is registered in INGESTORS
```

Would join `BOOTSTRAP_ORDER` / `UPDATE_ORDER` after news, since it depends on
the same person/org resolution.

## Cadence (planned)

- Wikidata enrichment: on-demand / weekly (7-day cache TTL).
- Elections: refresh against the election calendar (weekly).
- Office-holder changes: re-check on cabinet reshuffles; `validTo` closes the
  prior tenure, a new edge opens the next.

## Target tables (from `migrations.ts`)

- **`persons`**: `id`, `canonical_name`, `aliases`, `wikidata_id`, `roles`,
  `organizations`, `countries`, `data`, `mention_count`, `provenance`,
  `updated_at`.
- **`organizations`**: `id`, `canonical_name`, `aliases`, `wikidata_id`, `lei`,
  `country_code`, `data`, `mention_count`, `provenance`, `updated_at`.
- **`entities`** / **`relationships`**: generic nodes + typed, time-valid edges
  (`from_id`, `type`, `to_id`, `basis`, `valid_from`, `valid_to`, `confidence`).
- **`events`**: `kind='political'` for elections/appointments.

## Provenance

Every write flows through `lib/intel/repositories.ts`, which mirrors each
record into the `provenance` table (`provider`, `dataset`, `source_url`,
`retrieved_at`, `license`, `attribution`, `confidence`). Wikidata records carry
`license: "CC0"` and no attribution.
