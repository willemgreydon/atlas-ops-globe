# Sanctions — Planned Subjects & Entities

The canonical `Sanction` entity is **planned** (ontology type exists; no rows
stored). A sanction ties a **subject** to a **program** under an **authority**.

## Subject types

`subject_type ∈ { Person, Organization, Vessel, Aircraft, Entity }`, mapping to
ontology types `Person`, `Organization`, `Vessel`, `Aircraft`, and the generic
`Entity`/`Location` fallback.

## Universal identity — identifier-first (from `lib/intel/ids.ts`)

The subject is a real vault entity, keyed by an **authoritative identifier**,
never a provider list id or a name:

- **Person** → `IdOf.person(wikidataId?, name?)` — prefer QID/passport; name
  only as a last-resort hash, and then the match stays low-confidence.
- **Organization** → `IdOf.org({ wikidataId, lei, name })` — prefer LEI/QID.
- **Vessel** → `IdOf.vessel({ imo, mmsi })` → `vessel:imo-<IMO>` (preferred)
  or `vessel:mmsi-<MMSI>`.
- **Aircraft** → `IdOf.aircraft(icao24)` → `aircraft:icao24-<hex>`; registration
  (tail number) also usable.
- **Sanction record** → `IdOf.sanction(authority, programId)` →
  `stableId("sanction", authority, programId)`.

## `Sanction` — planned fields (`sanctions` table, from `migrations.ts`)

| column | meaning |
|---|---|
| `id` | `IdOf.sanction(authority, programId)` |
| `subject_type` | Person / Organization / Vessel / Aircraft / Entity |
| `subject_id` | the resolved vault entity id (e.g. `vessel:imo-…`) |
| `name` | primary listed name |
| `aliases` | JSON array of AKAs / transliterations |
| `program` | sanctions program (e.g. `UKRAINE-EO13662`) |
| `authority` | listing authority (OFAC / EU / OFSI / UN) |
| `jurisdiction` | jurisdiction the measure applies in |
| `listed_at` | designation date |
| `updated_at` | last list update seen |
| `identifiers` | JSON: IMO, MMSI, aircraft reg, ICAO24, LEI, registry id, QID, passport |
| `source` | source id (`ofac`/…) |
| `provenance` | JSON lineage |

## Identifiers block (critical)

`identifiers` is the heart of trustworthy matching. It captures every strong
key a list provides — IMO, MMSI, aircraft registration, ICAO24, LEI, national
registry id, Wikidata QID, passport/national-id numbers. These, not names, are
what link a sanctioned subject to a vessel (domain 04), aircraft (domain 03),
or organization/person (domain 06). Ambiguous or missing identifiers are
recorded as such, keeping the record honest about how confidently it resolves.
