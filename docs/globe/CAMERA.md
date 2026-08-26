# Camera System — `lib/globe/camera.ts`

`GlobeCameraController` wraps Cesium's camera with cinematic, distance-adaptive
motion (mission §15 §16 §18 §19).

## Free navigation (damping)

Tuned once on construction:
- `inertiaSpin/Translate = 0.9`, `inertiaZoom = 0.85` — weighty, settled feel.
- `enableCollisionDetection = true`, `minimumZoomDistance = 120 m` (no ground
  clipping), `maximumZoomDistance = 60 000 km` (high orbit).

## Flight model

Duration scales with **angular travel** across the globe surface, clamped to the
Motion System: 0.7 s (local) → 3.0 s (antipodal). Easing is
`QUINTIC_IN_OUT` — a slow, cinematic settle. `prefers-reduced-motion` forces
duration 0 (instant, mission §60).

## Semantic verbs (mission §16)

| Verb | Framing |
|---|---|
| `flyToLonLat(lon,lat,h,{pitch,heading})` | Generic, top-down by default |
| `flyToPoint(lon,lat,range)` | Analytical tilt (−55° pitch) via bounding-sphere |
| `flyToCountry` | 2 500 km altitude, top-down |
| `flyToEvent` | 350 km range, tilted |
| `flyToAircraft(…,altM)` | `max(80 km, alt×12)` range |
| `flyToVessel` | 120 km range |
| `flyToSatellite(…,altM)` | `max(alt×1.5, 1 500 km)` |
| `flyToInfrastructure` | 60 km range |
| `home()` | Pull back to full-disc orbital view |
| `zoomTowardCursor(carto)` | De-cluster: descend toward the ellipsoid pick |

Today `Globe.tsx` routes the store's generic `flyTo` request (from search /
command palette / inspector) through `flyToCountry`. Selection-kind-specific
framing (aircraft follow, event tilt) is wired as those render managers land in
Phase D — the verbs already exist.

## Idle auto-orbit (mission §18)

After `autoOrbitAfter` seconds (default 25) with no camera move, pointer, wheel
or key input, the camera rotates gently about the polar axis (~1 rev / 120 s).
**Any** interaction cancels it immediately; it never fights user input. Disabled
entirely under reduced-motion.

## Focus mode (mission §19) — implemented (fly-to + satellite trail)

Selecting an entity now flies the camera to it via the matching semantic verb:
aircraft/vessel/event/news/weather resolve their coordinates from the latest
feed rows (read through a `feedsRef` so the flight fires only on *selection
change*, never on a background poll); satellites propagate their current
sub-point via SGP4 and show an orbit trail (below). Clearing the selection hides
the trail. Still to come (Phase D): continuous *follow* of a moving target and
fading of non-focused layers.

## Bookmarks (mission §17) — planned

Named viewpoints (Global Operations, Hormuz, Taiwan Strait, Suez, …) persisted
locally, restored via `flyToLonLat`. Not yet built.
