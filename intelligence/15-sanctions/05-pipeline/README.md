# Sanctions — Pipeline (Planned)

**No sanctions ingestor is registered** in `lib/intel/registry.ts`
(`INGESTORS`), and there is **no `upsertSanction` writer** in
`repositories.ts`. `pnpm intel:sync sanctions` prints
`! unknown domain: sanctions` today. Everything below is intended behavior.

## Intended stages

`SOURCE → NORMALIZED → ENRICHED → MATCH → RELATIONSHIPS → PRODUCTS`.

1. **SOURCE** — bulk-download the OFAC SDN/consolidated list (then EU/UK/UN).
   Respect `minIntervalSec: 5`, `cacheTtlSec: 86400`. Store the raw file with a
   hash in provenance.
2. **NORMALIZED** — validate against a per-provider source schema; transform to
   the planned `VaultSanction`. Extract every identifier (IMO, MMSI, aircraft
   reg, ICAO24, LEI, registry id, QID, passport) into the `identifiers` block.
3. **ENRICHED** — resolve the subject to a vault entity by
   **identifier**: `IdOf.vessel({ imo })`, `IdOf.aircraft(icao24)`,
   `IdOf.org({ lei })`, `IdOf.person(wikidataId)`. When no strong identifier
   exists, create a standalone subject node and mark it low-confidence.
4. **MATCH** — link to existing domain entities **only** on a shared strong
   identifier. Name-only overlaps are recorded as candidates with
   `confidence < 0.5`, never as confirmed matches.
5. **RELATIONSHIPS** — write `SANCTIONED_BY` (subject → authority) and
   `SUBJECT_TO` (subject → program) edges (basis `direct`).
6. **PRODUCTS** — screening lookups; flags on vessels/aircraft/orgs elsewhere
   in the vault.

## CLI (planned)

```
pnpm intel:sync sanctions      # once an ingestor is registered in INGESTORS
```

Would join `UPDATE_ORDER` for daily refresh; a `upsertSanction(...)` writer in
`repositories.ts` is a prerequisite.

## Cadence (planned)

- OFAC/EU/UK/UN lists: **daily** (1-day cache TTL). Delisting and update dates
  are tracked via `updated_at`; nothing is silently dropped.

## Target table (from `migrations.ts`)

`sanctions`: `id`, `subject_type`, `subject_id`, `name`, `aliases`, `program`,
`authority`, `jurisdiction`, `listed_at`, `updated_at`, `identifiers`,
`source`, `provenance`.

## Provenance

Once wired, writes flow through the repository layer, mirroring each record to
`provenance` (`provider`, `source_url`, `retrieved_at`, `license`, `raw_hash`,
`confidence`). OFAC records carry `license: "US Government open data"` and no
attribution. The `raw_hash` of each downloaded list is retained for audit.
