# 03 — Aviation · Entities

Canonical entity types (from `lib/intel/ontology.ts`) and universal IDs (from
`lib/intel/ids.ts`). Only **Aircraft** is populated today; the rest are
modelled but not ingested (PLANNED).

## Canonical entity types

| Entity | Ontology type | Status | Notes |
|---|---|---|---|
| Aircraft | `Aircraft` | IMPLEMENTED | One row per airframe in `aircraft`, keyed by ICAO24. |
| Flight | `Flight` | PLANNED | No flight records ingested; callsign appears only as an `aircraft` column. |
| Airport | `Airport` | PLANNED | `airports` table schema exists, empty (OurAirports not loaded). |
| Airline | `Airline` | PLANNED | No airline records; not derived from callsigns today. |

## Universal IDs (`IdOf`)

| Entity | Minting rule | Example |
|---|---|---|
| Aircraft | `aircraft:icao24-${icao24.toLowerCase()}` | `aircraft:icao24-3c6dd2` |
| Flight | `stableId("flight", callsign, day)` (deterministic hash) | `flight:<hash>` |
| Airport | `airport:icao-${icao.toUpperCase()}` | `airport:icao-EDDF` |

The identity rule: a provider-specific ID is **never** the primary identity.
Where an authoritative universal identifier exists (ICAO24 hex for airframes,
ICAO code for airports) it becomes the key; otherwise a deterministic
`stableId` is derived (e.g. Flight from callsign + day).

> Note: the OpenSky *provider* (`lib/providers/opensky.ts`) emits an internal
> `aircraft:${icao24}` id on its `AircraftState`; the aviation ingestor stores
> that value directly as the `aircraft.id` primary key. The canonical
> `IdOf.aircraft` scheme (`aircraft:icao24-<hex>`) is the vault-standard form.

## Key fields per entity

**Aircraft** (populated — see `aircraft` table / `AircraftState`):
- `icao24` — 24-bit ICAO transponder address (hex), the airframe identity.
- `callsign` — flight callsign as broadcast (may be null/blank).
- `country` — origin country of registration (OpenSky `originCountry`).
- `lat`, `lon`, `alt` — last known position (barometric altitude, metres).
- `velocity` (m/s), `heading` (deg true track), `on_ground` (bool).
- `last_contact` — ISO timestamp of the last received state.

**Airport** (planned — `airports` schema): `icao`, `iata`, `name`,
`country_code`, `lat`, `lon`, `type`, `data`.

**Flight / Airline** (planned): no persisted columns yet; ontology types only.
