# Level of Detail

Status: **enforced (v1).** `lib/globe/lod.ts` (`LodController`) samples camera
height off the render loop and applies two policies to the live datasources:
altitude-banded **layer visibility** (fine ground layers — weather, news — hide
from orbit where they read as noise) and a **label budget** (the active quality
preset's `maxLabels`, keeping the nearest-to-camera labels and hiding the rest).
The pure policy core is unit-tested; the current band shows in the dev perf
panel. Still planned below: model LOD, priority-ranked declutter, viewport fetch.

## Altitude bands (mission §14)

| Band | Camera height | Reveal |
|---|---|---|
| ORBIT | > 8 000 km | global aggregates: event/flight/shipping density, storms, satellites |
| CONTINENT | 2 000–8 000 km | major individual events, corridors, national boundaries, weather systems |
| COUNTRY | 400–2 000 km | cities, airports, vessels, aircraft, events, critical infra |
| REGIONAL | 60–400 km | detailed tracks, roads, ports, facilities, local incidents |
| CITY | < 60 km | buildings (where available), detailed terrain, photorealistic 3D, individual assets |

The camera altitude is already surfaced (perf panel; `camera.changed`), so the
band classifier has its input.

## Model LOD (mission §85)

Per quality preset (`modelSwapAltitude`): above → point/billboard; below →
optional glTF. Never render thousands of detailed models globally.

- Aircraft: > 1000 km point · 100–1000 km billboard · < swap-altitude glTF.
- Vessels / satellites: analogous.

## Declutter engine (mission §104 §106) — planned

Central policy: inputs = camera height, entity priority, screen density,
selection, mode → outputs = `visible`, `labelVisible`, `detailLevel`. Render
priority enum (§107): `CRITICAL_ALERT > SELECTED > TRACKED > HIGH > NORMAL >
BACKGROUND`. Clusters aggregate; low-priority labels hide first at distance.

## Camera-driven data fetching (mission §78 §79) — planned

`GlobeViewportController` produces `{bbox, center, altitude, zoomClass}` (debounced)
so the client queries aggregates at orbit, regional entities at country, detailed
entities at city — never the whole planet at once.
