# Politics — Planned Canonical Entities

All entities below are **planned**. The ontology types they map onto exist in
`lib/intel/ontology.ts` (`ENTITY_TYPES`); no political rows are stored today.

## Universal identity (from `lib/intel/ids.ts`)

Rule (verbatim from `ids.ts`): a provider-specific ID is **never** the primary
identity. IDs are minted as `type:key`; an authoritative universal identifier
is preferred as the key, otherwise a deterministic `stableId` hash is derived.

- `IdOf.person(wikidataId?, name?)` → `person:Q567` when a QID is known,
  else `person:<hash(name)>`.
- `IdOf.org({ wikidataId?, lei?, name? })` → `org:Q<qid>`, else
  `org:LEI-<lei>`, else `org:<hash(name)>`.
- `IdOf.country(iso2)` → `country:DE` — the anchor for political profiles.
- `IdOf.event(provider, providerId)` → `event:<provider>:<id>` for
  `PoliticalEvent`.

## Planned entities → ontology mapping

| Planned entity | Ontology type | Key / ID |
|---|---|---|
| `PublicOfficial` | `Person` / `PublicFigure` | `person:<QID>` (Wikidata) or hash |
| `Government` | `GovernmentOrganization` | `org:<QID>` or hash |
| `Parliament` | `GovernmentOrganization` | `org:<QID>` or hash |
| `Ministry` | `GovernmentOrganization` | `org:<QID>` or hash |
| `Party` | `Organization` | `org:<QID>` or hash |
| `PoliticalOffice` | (role, modeled on the edge) | attribute of `HEAD_OF`/`MEMBER_OF` |
| `Election` | `PoliticalEvent` | `event:<provider>:<id>` |
| `Treaty` | `Organization` / `Regulation` | `org:<QID>` or hash |
| `PoliticalEvent` | `PoliticalEvent` | `event:<provider>:<id>` |

## Fields (intended)

- **PublicOfficial** (`persons` table): `id`, `canonical_name`, `aliases[]`,
  `wikidata_id`, `roles[]`, `organizations[]`, `countries[]`, `data` (birth,
  party), `mention_count`, `provenance`.
- **Government / Parliament / Ministry / Party** (`organizations` table):
  `id`, `canonical_name`, `aliases[]`, `wikidata_id`, `lei`, `country_code`,
  `data`, `mention_count`, `provenance`.
- **Election / PoliticalEvent** (`events` table): `id`, `kind`
  (`political`), `subtype` (`election`/`appointment`/`referendum`), `title`,
  `occurred_at`, `country_code`, `source`, `confidence`, `tags`.
- **PoliticalOffice / Treaty**: modeled primarily as generic `entities` +
  time-valid `relationships` (see 06-relationships).

## Time-validity (critical)

Office-holder facts are **never** point-in-time overwrites. A `PublicOfficial`
`HEAD_OF` a `Government` carries `validFrom` and `validTo` on the relationship
(`VaultRelationship` supports both). This preserves succession history and lets
queries ask "who held office on date D".
