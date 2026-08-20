# 09 — Energy · Entities (PLANNED)

The `energy` domain contributes **one** canonical entity type from
`lib/intel/ontology.ts`: `EnergyAsset` (in `ENTITY_TYPES`, grouped under
"Infrastructure & energy"). Nothing is populated — `entities` holds no
`EnergyAsset` rows today.

## Canonical super-type

`EnergyAsset` — stored as a generic node in the `entities` table with
`type = "EnergyAsset"`. All specialization is carried in the JSON `data` blob,
keeping the ontology small and graph-mappable.

### Planned subtypes (`data.subtype`)

PowerPlant, Substation, Pipeline, Refinery, LNGTerminal, OilTerminal,
GasStorage, Interconnector, HydroelectricDam, WindFarm, SolarFarm, NuclearPlant.

## Universal identity (`lib/intel/ids.ts`)

`ids.ts` defines **no** dedicated minter for energy assets. Per the rule "a
provider-specific ID is NEVER the primary identity", planned assets would mint
`stableId("energy-asset", <naturalKey>)` → `energy-asset:<hash>`, where the
natural key is the most authoritative available (e.g. GEM tracker ID, OSM
`way/relation` id, EIA plant code). Where an asset maps to a known country it
also links to `IdOf.country(iso2)` → `country:AT`. Adding a first-class
`IdOf.energyAsset(...)` minter is a planned change to `ids.ts`.

## Planned `data` fields

Common (all subtypes):
- `subtype` — one of the planned subtypes above
- `capacityMw` / `capacityValue` + `capacityUnit` — MW electrical, or bcm/y,
  Mt/y, m³ storage depending on subtype
- `fuelType` — coal | gas | oil | nuclear | hydro | wind | solar | biomass | …
- `operator`, `owner` — resolved to `Organization`/`Company` entities where known
- `status` — operating | construction | planned | mothballed | retired
- `commissionedYear`, `country` (ISO2), `lat`, `lon`

Subtype extras (examples):
- Pipeline / Interconnector: `endpoints` (two entity ids), `lengthKm`, `medium`
- LNGTerminal / GasStorage: `throughputBcmY`, `workingVolumeM3`
- WindFarm / SolarFarm: `turbineCount`, `panelAreaKm2`, `offshore` (bool)
- NuclearPlant: `reactorCount`, `reactorType`

`lat`/`lon`/`countryCode` populate the top-level `entities` columns for geo
queries; everything else lives in `data`. Quality is tracked via the
`VaultQuality` block (`geoPrecision`, `entityConfidence`, `sourceAgreement`).
