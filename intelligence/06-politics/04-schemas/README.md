# Politics — Schemas

The politics domain reuses the **generic** canonical schemas in
`lib/intel/schemas.ts`. There is no dedicated `VaultPublicOfficial` or
`VaultGovernment` schema yet — those specifics live in the `persons` /
`organizations` table columns (`lib/intel/migrations.ts`) and in the generic
`VaultEntity.data` bag until a domain schema is added.

## Existing schemas used (in `schemas.ts`)

- **`VaultEntity`** — generic node: `id`, `type`, `name`, `countryCode?`,
  `lat?`, `lon?`, `data` (record), `quality?`, `provenance[]`. Used for
  `Person`/`PublicFigure`/`GovernmentOrganization` nodes.
- **`VaultRelationship`** — `id`, `from`, `type`, `to`, `basis`, `validFrom?`,
  `validTo?` (nullable), `confidence` (default 0.5), `provenance[]`. This is
  the schema that carries **time-valid** office tenure.
- **`VaultEvent`** — `id`, `kind`, `subtype?`, `title`, `severity`,
  `occurredAt`, `countryCode?`, `source`, `confidence?`, `tags[]`. Used for
  `PoliticalEvent`/`Election`.
- **`VaultProvenance`** / **`VaultQuality`** — lineage + quality on every node.

## Planned (NOT yet in `schemas.ts`)

Dedicated `VaultPublicOfficial` and `VaultGovernment` Zod schemas mirroring the
`persons` / `organizations` columns. Until added, political records are stored
as `VaultEntity` with domain fields under `data`.

## Example — PublicOfficial as VaultEntity (planned)

```json
{
  "id": "person:Q567",
  "type": "PublicFigure",
  "name": "Angela Merkel",
  "countryCode": "DE",
  "data": { "wikidataId": "Q567", "party": "org:Q49762", "roles": ["Chancellor"] },
  "quality": { "entityConfidence": 0.99 },
  "provenance": [{
    "provider": "wikidata", "providerRecordId": "Q567",
    "sourceUrl": "https://www.wikidata.org/wiki/Q567",
    "retrievedAt": "2026-08-20T00:00:00Z", "license": "CC0"
  }]
}
```

## Example — time-valid HEAD_OF (planned)

```json
{
  "id": "rel:person-Q567:HEAD_OF:org-DE-gov",
  "from": "person:Q567", "type": "HEAD_OF", "to": "org:Q<german-gov>",
  "basis": "direct", "validFrom": "2005-11-22", "validTo": "2021-12-08",
  "confidence": 0.99,
  "provenance": [{ "provider": "wikidata", "retrievedAt": "2026-08-20T00:00:00Z" }]
}
```

## Example — Election as VaultEvent (planned)

```json
{
  "id": "event:electionguide:12345",
  "kind": "political", "subtype": "election",
  "title": "German federal election", "severity": "info",
  "occurredAt": "2025-02-23", "countryCode": "DE",
  "source": "electionguide", "tags": ["election", "legislative"]
}
```

Validation discipline (from `schemas.ts`): external payloads validate against a
per-provider source schema, transform to these canonical shapes, then validate
again before storage. Malformed records are logged and skipped, never stored raw.
