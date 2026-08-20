# 02 · Conflict Intelligence — Overview

**Status:** SCAFFOLDED / PLANNED. Folder, ontology types and target schema
exist; **no source is wired and no data is ingested today.** This document
describes the *intended* pipeline honestly — nothing below is live unless
explicitly marked IMPLEMENTED.

## Mission

Track armed conflict and political violence — event type, location, actors,
timing — to complement the disasters domain with human-caused crisis data.
Discipline is the point: **neutral analytical labelling; never infer casualties
from ambiguous reporting; never convert rumours into facts.**

## At a glance

| Aspect | Value |
|---|---|
| Sources | `acled` (CREDENTIAL_REQUIRED, OAuth), GDELT events, `reliefweb` (NEXT), UCDP/UN (RESEARCH) — **none live** |
| Entities | ConflictEvent, Person/Organization (actors), Country |
| Target schema | `VaultEvent` (`kind: "conflict"`) |
| Target table | `events` (shared) + `relationships`, `provenance` |
| IDs | `IdOf.event(provider, providerId)` → `event:<provider>:<id>` |
| CLI | none yet (would register under `pnpm intel:sync conflict`) |
| API | would surface via `GET /api/intelligence/events?kind=conflict` |
| Ingestor | not present (`lib/intel/domains/conflict.ts` PLANNED) |

## Why scaffolded, not implemented

- **ACLED** — the richest structured conflict dataset — requires OAuth
  credentials (`ACLED_CLIENT_ID`, `ACLED_CLIENT_SECRET`); `enabled: false`,
  `status: credential-required`.
- **ReliefWeb** — free (OCHA terms) humanitarian context — is `status: next`,
  `enabled: false`; the natural first wire-up.
- **GDELT events** could provide event coverage from the already-wired GDELT
  account, but the events (GEG/EVENT) endpoints are not yet integrated.
- **UCDP / UN** — RESEARCH stage: license and modelling still under review.

## Intended pipeline shape (PLANNED)

`ReliefWeb / ACLED → provider fetch (Zod-validated) → transform to VaultEvent
(kind="conflict") → nearestCountry / reported geocode → upsertEvent + fts_events
→ linkEventCountry (basis reported|spatially-near)`.

## Contents

- [02 · Sources](../02-sources/README.md) — ACLED, ReliefWeb, GDELT, UCDP/UN
- [03 · Entities](../03-entities/README.md) — ConflictEvent, actors, IDs
- [04 · Schemas](../04-schemas/README.md) — target `VaultEvent`
- [05 · Pipeline](../05-pipeline/README.md) — intended stages & cadence
- [06 · Relationships](../06-relationships/README.md) — planned edges & basis
- [07 · Analysis & Gaps](../07-analysis-and-gaps/README.md) — metrics, gaps, ethics
