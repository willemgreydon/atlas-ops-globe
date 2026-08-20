# Sanctions — Schemas

There is **no dedicated `VaultSanction` Zod schema in `lib/intel/schemas.ts`
yet.** The `sanctions` table columns exist in `lib/intel/migrations.ts` and
`Sanction` is an ontology type, but the canonical schema below is **planned**.

## Existing schemas reused (in `schemas.ts`)

- **`VaultEntity`** / **`VaultVessel`** — the sanctioned subject nodes
  (person/org via `VaultEntity`; vessels via `VaultVessel`).
- **`VaultRelationship`** — carries `SANCTIONED_BY` / `SUBJECT_TO` edges with a
  `confidence` field (default 0.5) — used to preserve match ambiguity.
- **`VaultProvenance`** / **`VaultQuality`** — lineage + `entityConfidence`.

## Planned — `VaultSanction` (NOT in `schemas.ts`)

Mirrors the `sanctions` columns; `identifiers` is a structured record so
matching keys are validated, not free text:

```ts
// PLANNED — to be added to lib/intel/schemas.ts
export const VaultSanction = z.object({
  id: z.string(),                 // IdOf.sanction(authority, programId)
  subjectType: z.enum(["Person","Organization","Vessel","Aircraft","Entity"]),
  subjectId: z.string(),          // resolved vault entity id
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  program: z.string().optional(),
  authority: z.string(),          // OFAC | EU | OFSI | UN
  jurisdiction: z.string().optional(),
  listedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  identifiers: z.object({
    imo: z.string().optional(), mmsi: z.string().optional(),
    aircraftReg: z.string().optional(), icao24: z.string().optional(),
    lei: z.string().optional(), registryId: z.string().optional(),
    wikidataId: z.string().optional(), passport: z.array(z.string()).default([]),
  }).default({}),
  source: z.string(),
  provenance: z.array(VaultProvenance).default([]),
});
```

## Example — sanctioned vessel (planned)

```json
{
  "id": "sanction:<hash(ofac,IFCA)>",
  "subjectType": "Vessel", "subjectId": "vessel:imo-9175265",
  "name": "EXAMPLE MARU", "aliases": ["EX MARU"],
  "program": "IFCA", "authority": "OFAC", "jurisdiction": "US",
  "listedAt": "2024-11-01", "updatedAt": "2026-08-19",
  "identifiers": { "imo": "9175265", "mmsi": "477000000" },
  "source": "ofac",
  "provenance": [{ "provider": "ofac",
    "sourceUrl": "https://sanctionslist.ofac.treas.gov/…",
    "retrievedAt": "2026-08-20T00:00:00Z", "license": "US Government open data" }]
}
```

## Example — sanctioned person (planned)

```json
{
  "id": "sanction:<hash(eu,UKR)>",
  "subjectType": "Person", "subjectId": "person:Q<qid>",
  "name": "Jane Doe", "aliases": ["J. Doe"], "program": "UKR",
  "authority": "EU", "jurisdiction": "EU", "listedAt": "2022-03-15",
  "identifiers": { "wikidataId": "Q123", "passport": ["A1234567"] },
  "source": "eu"
}
```

Validation discipline (from `schemas.ts`): provider payloads validate against a
per-provider source schema, transform to the canonical shape, then validate
again before storage. Malformed records are logged and skipped.
