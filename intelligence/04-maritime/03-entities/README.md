# 04 — Maritime · Entities

Canonical entity types (`lib/intel/ontology.ts`) and universal IDs
(`lib/intel/ids.ts`). Only **Vessel** is ingested (when keyed); Voyage and Port
are modelled but not populated.

## Canonical entity types

| Entity | Ontology type | Status | Notes |
|---|---|---|---|
| Vessel | `Vessel` | IMPLEMENTED (credential-gated) | One row per vessel in `vessels`, IMO-first identity. |
| Voyage | `Voyage` | PLANNED | Destination/ETA are columns on the vessel row, not a Voyage entity. |
| Port | `Port` | PLANNED | `ports` schema exists, empty; no UN/LOCODE reference loaded. |

## Universal IDs (`IdOf`)

| Entity | Minting rule | Example |
|---|---|---|
| Vessel | `opts.imo ? \`vessel:imo-${imo}\` : \`vessel:mmsi-${mmsi}\`` | `vessel:imo-9743493` / `vessel:mmsi-636092910` |
| Port | `port:unlocode-${unlocode.toUpperCase()}` | `port:unlocode-AEJEA` |

**IMO-first identity.** IMO is a permanent hull identifier and is preferred; MMSI
(which can change with flag/ownership) is the fallback. MarineTraffic's `"0"`
sentinel for an unknown IMO/MMSI is treated as absent, so a `"0"` IMO does **not**
produce a `vessel:imo-0` id — the MMSI is used instead. A record with neither is
dropped.

## Key fields per entity

**Vessel** (populated when keyed — `VaultVessel`):
- `imo` — IMO number (permanent hull id), optional after `"0"` filtering.
- `mmsi` — Maritime Mobile Service Identity, optional after `"0"` filtering.
- `name` (`SHIPNAME`), `vesselType` (`TYPE_NAME` or `SHIPTYPE`), `flag` (`FLAG`).
- `lat`, `lon` — required position (gated by `isValidPoint`).
- `speedKn` — knots (from `SPEED/10`), `courseDeg` (`COURSE`), `headingDeg` (`HEADING`).
- `navigationStatus` (`STATUS`), `destination` (`DESTINATION`), `eta` (`ETA`).
- `lastContact` — `TIMESTAMP` or ingest time.

**Port** (planned — `ports` schema): `unlocode`, `name`, `country_code`, `lat`,
`lon`, `data`.

**Voyage** (planned): no persisted table; destination/ETA live on the vessel row.

> Neutral terminology: absence of position/AIS is a **signal gap**, never an
> accusation of dark activity.
