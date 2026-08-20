# 16 — Space · Entities

Canonical entity types (`lib/intel/ontology.ts`) and universal IDs
(`lib/intel/ids.ts`). **Satellite / SpaceObject** are populated; Orbit and
GroundStation are modelled but not persisted as separate entities.

## Canonical entity types

| Entity | Ontology type | Status | Notes |
|---|---|---|---|
| Satellite | `Satellite` | IMPLEMENTED | Each `space_objects` row (NORAD-keyed). |
| SpaceObject | `SpaceObject` | IMPLEMENTED | Same table; debris/rocket bodies share the shape (`objectType`). |
| Orbit | `Orbit` | PLANNED | Orbit geometry is stored as columns on the object, not a separate Orbit entity. |
| GroundStation | `GroundStation` | PLANNED | No ground-station data ingested. |

## Universal IDs (`IdOf`)

| Entity | Minting rule | Example |
|---|---|---|
| Satellite / SpaceObject | `satellite:norad-${norad}` | `satellite:norad-25544` (ISS) |

**NORAD-keyed identity.** The NORAD catalog number is the authoritative
universal identifier and becomes the id key directly. COSPAR (`OBJECT_ID`) is
stored as an attribute (`cospar`) but is not the primary key.

## Key fields per entity

**Satellite / SpaceObject** (populated — `VaultSpaceObject`):
- `norad` — NORAD catalog id (identity).
- `cospar` — COSPAR / international designator (`OBJECT_ID`), optional.
- `name` — object name (`OBJECT_NAME`, defaults to `NORAD <id>`).
- `epoch` — element-set epoch (`EPOCH`).
- `inclinationDeg` — orbital inclination (`INCLINATION`).
- `periodMin`, `apogeeKm`, `perigeeKm` — **derived** from MEAN_MOTION /
  ECCENTRICITY (see 04-schemas / 05-pipeline).
- `objectType`, `operator`, `country`, `launchDate` — schema fields, **not
  populated** by the OMM path (left null).
- `tleLine1` / `tleLine2` — schema fields, not populated by OMM-JSON.

**Orbit** (planned): represented inline via period/apogee/perigee/inclination
columns; no standalone Orbit entity or SGP4-propagated position.
