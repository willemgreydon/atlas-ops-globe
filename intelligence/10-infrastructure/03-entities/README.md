# 10 — Infrastructure · Entities (PLANNED)

From `lib/intel/ontology.ts`, this domain owns three `ENTITY_TYPES`:
`InfrastructureAsset` (super-type), `Airport`, and `Port` (both first-class).
Nothing is populated — `airports`, `ports`, and `InfrastructureAsset` rows in
`entities` are all empty.

## Canonical types

- **`Airport`** — dedicated `airports` table + optional `entities` mirror.
- **`Port`** — dedicated `ports` table + optional `entities` mirror.
- **`InfrastructureAsset`** — generic node in `entities`, specialized via
  `data.subtype`.

### Planned subtypes (`InfrastructureAsset.data.subtype`)

Railway, Highway, Bridge, Tunnel, PowerPlant, PowerLine, Pipeline, DataCenter,
SubmarineCable, TelecomTower, Hospital, GovernmentBuilding, IndustrialFacility,
Dam, WaterInfrastructure. (PowerPlant/PowerLine/Pipeline/Dam overlap the energy
domain — the same physical asset may be typed for either domain depending on
source; provenance disambiguates.)

## Universal identity (`lib/intel/ids.ts`)

- **Airport:** `IdOf.airport(icao)` → `airport:icao-EDDF` (ICAO is the universal
  key; falls back only if ICAO absent).
- **Port:** `IdOf.port(unlocode)` → `port:unlocode-DEHAM` (UN/LOCODE key).
- **Other assets:** `ids.ts` has no dedicated minter → plan
  `stableId("infra-asset", <osmType/id | authorityId>)` →
  `infra-asset:<hash>`; link to `IdOf.country(iso2)` where known. A first-class
  `IdOf.infraAsset(...)` is a planned addition.

## Planned fields

`airports` table columns: `id, icao, iata, name, country_code, lat, lon, type,
data, provenance`. `ports` columns: `id, unlocode, name, country_code, lat, lon,
data, provenance`.

`InfrastructureAsset.data`:
- `subtype` (see list), `operator`/`owner` (resolved org ids), `status`
  (operating | construction | planned | closed)
- geometry hints: `lengthKm` (linear assets), `capacity` (throughput/pax/TEU),
  `osmId`, `authorityId`
- `country` (ISO2), `lat`, `lon` mirror the top-level entity columns for geo

Quality via `VaultQuality` (`geoPrecision`, `entityConfidence`,
`sourceAgreement`).
