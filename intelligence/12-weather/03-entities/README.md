# 12 — Weather · Entities (PLANNED)

`lib/intel/ontology.ts` defines one weather entity in `ENTITY_TYPES`:
`WeatherObservation`. Two further intended types — `WeatherForecast` and
`WeatherSystem` — are **not yet in the ontology** and are planned additions.
Nothing is populated — `weather_observations` is empty.

## Canonical types

- **`WeatherObservation`** (EXISTING type) — a measured/analyzed value of a
  weather variable at a location and **observation time**. Maps directly onto the
  `weather_observations` table.
- **`WeatherForecast`** (PLANNED type) — a *predicted* value carrying both an
  **issue time** (model run / publication) and a **target time** (the predicted
  moment). Distinct from an observation precisely because of the two timestamps.
- **`WeatherSystem`** (PLANNED type) — a tracked feature (cyclone, front, storm
  cell) with a track over time; would live in `entities` with a geometry/track in
  `data`.

## Universal identity (`lib/intel/ids.ts`)

`ids.ts` has **no** weather minter. Planned deterministic keys via `stableId`:
- observation: `stableId("wxobs", provider, variable, lat, lon, observedAt)`
- forecast: `stableId("wxfcst", provider, variable, lat, lon, issuedAt, targetAt)`
  — issue **and** target time both in the key so re-issues don't collide.
- system: `stableId("wxsystem", provider, systemId)`.

Link to `IdOf.country(iso2)` where a point resolves to a country.

## Tracked variables (planned)

`temperature`, `precipitation`, `wind` (speed + direction), `pressure`,
`clouds`, `visibility`, `snow`, `humidity`, `storms`, `lightning`.

## Planned fields

`WeatherObservation` (via `weather_observations` columns): `lat`, `lon`,
`observed_at`, `variable`, `value`, `unit`, `provider`.

`WeatherForecast.data` (PLANNED): `variable`, `value`, `unit`, `issuedAt`,
`targetAt`, `leadTimeHours`, `model` (ECMWF-IFS | GFS | ICON | …), `ensemble`.

`WeatherSystem.data` (PLANNED): `systemType` (tropical_cyclone | extratropical |
front | thunderstorm), `track` (array of `{time, lat, lon, intensity}`),
`category`, `centralPressure`.

Quality via `VaultQuality` (`temporalPrecision`, `geoPrecision`).
