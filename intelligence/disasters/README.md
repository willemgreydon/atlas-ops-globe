# disasters

**Status: Implemented**

## Purpose
Natural-hazard situational awareness: earthquakes and NASA-tracked natural
events, normalized into canonical disaster events with country resolution.

## Current sources
- **USGS Earthquakes** (`usgs`) — earthquake GeoJSON feed.
- **NASA EONET** (`eonet`) — wildfires, storms, volcanoes, and other natural
  events. ~123 events total across both providers.

## Canonical entities
- `DisasterEvent` / `Event` (see `VaultEvent`, `kind = "disaster"`).

## Update frequency
- Polling. USGS min interval 30s (cache 60s); EONET cache 300s. Included in
  `pnpm intel:update`.

## Storage
- `events` table (`kind = "disaster"`); country links in `relationships` with
  basis `reported` or `spatially-near`; `provenance` rows.

## Known limitations
- Events without a reported country are attributed by nearest centroid
  (`spatially-near`), imprecise near borders/coasts.
- Coverage limited to what USGS + EONET report; no humanitarian impact context.

## Licensing considerations
- Both US Gov / NASA open data — commercial use and redistribution allowed;
  attribution required ("U.S. Geological Survey", "NASA EONET").

## Next sources
- **ReliefWeb** (`reliefweb`, `next`) for humanitarian situation reports.
