# _core — vault backbone

`_core` holds the shared, cross-domain definitions and generated reference
artifacts that every domain resolves against. It is the declarative layer; the
executable pipeline that reads and populates it lives in `lib/intel/`.

## Contents

| Folder | Purpose | Committed? |
|---|---|---|
| `ontology/` | Emitted controlled vocabulary — entity types, relation types, relationship basis, domains (`ontology.json`). Source of truth: `lib/intel/ontology.ts`. | yes |
| `schemas/` | Canonical record shapes (events, news, vulnerabilities, space objects, economic observations, countries). Source of truth: `lib/intel/schemas.ts` (Zod). | yes |
| `sources/` | The source registry emitted as `registry.json` — id, domains, endpoint, auth, license posture, acquisition config. Source of truth: `lib/intel/sources.ts`. | yes |
| `countries/` | Country reference backbone (Natural Earth seed). | yes |
| `geography/` | Geographic reference data used for country resolution / spatial linking. | yes |
| `taxonomy/` | Domain and category taxonomies. | yes |
| `indexes/` | Generated lookup indexes (articles-by-country, events-by-country, events-by-date). Rebuilt by `pnpm intel:index`. | gitignored |
| `manifests/` | Run manifests, e.g. `status.json` (last ingest report per domain). | `status.json` gitignored |

## Identity & provenance

- **Universal IDs** (`lib/intel/ids.ts`): a provider-specific id is never the
  primary identity. IDs are `type:key` — using an authoritative universal
  identifier as the key where one exists (ISO code, Wikidata QID, ICAO24, IMO,
  NORAD, CVE id), otherwise a deterministic `stableId` derived from source
  identifiers.
- **Ontology** (`lib/intel/ontology.ts`): entity types, relation types, the
  relationship `basis` enum, and the 16 intelligence domains.
- **Schemas** (`lib/intel/schemas.ts`): canonical Zod shapes plus
  `VaultProvenance` and `VaultQuality`, which every stored record carries.

## Pointer

For the executable pipeline — ingestors, SQLite storage, migrations, query
layer, CLI logic — see `lib/intel/`. Regenerate `_core` artifacts with
`pnpm intel:index` (or `pnpm intel:bootstrap`, which emits them first).
