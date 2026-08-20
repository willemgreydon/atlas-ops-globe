# Sanctions — Overview

**Status: SCAFFOLDED** — the `sanctions` table exists
(`lib/intel/migrations.ts`), `Sanction` is an ontology type, and one source
(`ofac`, `next`, free) has a registry entry in `lib/intel/sources.ts`. **No
sanctions data is ingested today** — the table is empty despite OFAC being
zero-cost. Everything below is intended design.

## Mission

Provide designated-party awareness — who is listed, by which authority, under
which program, since when — for persons, organizations, vessels, aircraft, and
other entities. This is a screening backbone: it must be trustworthy about
identity, because a false positive or false negative both carry real cost.

**Critical discipline (matching):** never assert a sanctions match on **name
similarity alone**. A match requires an authoritative identifier — IMO, MMSI,
aircraft registration, ICAO24, LEI, national registry id, Wikidata QID, or
passport number. Ambiguity and confidence are preserved as first-class data,
never collapsed into a false certainty.

## At a glance (all PLANNED)

- **Planned sources:** `ofac` (`next`, US Gov open) for the SDN / consolidated
  lists; then the **EU consolidated list**, **UK (OFSI)**, and **UN Security
  Council** consolidated list.
- **Planned subjects:** Person, Organization, Vessel, Aircraft, Entity.
- **Planned canonical entity:** `Sanction` (ontology type) linking a subject to
  a program and authority.
- **Intended table:** `sanctions` (`subject_type`, `subject_id`, `name`,
  `aliases`, `program`, `authority`, `jurisdiction`, `listed_at`,
  `updated_at`, `identifiers`, `source`, `provenance`) — defined in
  `migrations.ts`, empty today.
- **Planned CLI:** `pnpm intel:sync sanctions` (no ingestor registered yet).

## Contents

- [02-sources](../02-sources/README.md) — planned lists, auth, licensing, status
- [03-entities](../03-entities/README.md) — subject types + identifier-first IDs
- [04-schemas](../04-schemas/README.md) — planned Zod shape + example JSON
- [05-pipeline](../05-pipeline/README.md) — intended stages, CLI, target table, cadence
- [06-relationships](../06-relationships/README.md) — SANCTIONED_BY / SUBJECT_TO edges
- [07-analysis-and-gaps](../07-analysis-and-gaps/README.md) — metrics, queries, matching discipline

## Honest status

The `sanctions` table is empty. There is no ingestor and no repository writer
for it. OFAC is free and `next` but not wired — a notable low-hanging gap. This
domain is scaffolding only.
