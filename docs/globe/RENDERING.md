# Rendering

## Scene configuration — `lib/globe/scene.ts`

`configureScene(viewer, {quality, atmosphere, lighting})` is the one imperative
pass that makes the Earth premium. Idempotent; re-called on config change.

### Atmosphere presets (mission §5 §7)

Four characters, each a bundle of physically-inspired scattering parameters
applied to both `scene.atmosphere` (ground/limb haze) and `scene.skyAtmosphere`
(orbital blue rim):

| Preset | Character |
|---|---|
| scientific | Neutral, no saturation/brightness shift, HDR off |
| **natural** (default) | Subtle Rayleigh blue, restrained bloom, HDR on |
| cinematic | Slightly richer saturation + brightness, HDR on |
| minimal | Desaturated, dimmed — data-first analyst look |

Rayleigh coefficients follow the real `(5.8, 13.5, 33.1)×10⁻⁶` blue-sky ratio;
Mie is near-isotropic-forward (`anisotropy ≈ 0.9`). No neon, no glow (§128).

### Lighting modes (mission §6)

- **realtime-sun** (default): globe lighting + dynamic atmosphere lit by real sun
  position; `viewer.clock` set to now, animating.
- **timeline-sun**: same, but sun follows `viewer.clock` — the hook the Phase F
  time controller drives during replay/scrubbing.
- **flat-analytical**: lighting off, even illumination so data reads cleanly.

Shadows enable only at ultra + a sun-based lighting mode.

### Frame-budget knobs — `applyQuality`

`resolutionScale`, `scene.msaaSamples` (guarded — some contexts reject it),
`postProcessStages.fxaa.enabled`, terrain `maximumScreenSpaceError`,
`tileCacheSize`, and low-altitude `fog` (density 2×10⁻⁴, depth cue per §102).
These are exactly what the performance governor re-applies when it degrades.

## Imagery / terrain

- **Imagery:** OpenStreetMap raster (`alpha 0.7`, `brightness 0.62`) for a dark
  intelligence base. No ion token in this environment, so ion imagery and Cesium
  World Terrain are unavailable — the app runs on the smooth ellipsoid (§120
  fallback ladder). Basemap presets + terrain provider abstraction land in
  Phase B; see `PROVIDERS.md`.
- **Occlusion (§65 §66):** markers currently use
  `disableDepthTestDistance = Infinity` (draw-through) so symbols read from any
  angle. Switching mass markers to depth-tested primitives that respect the
  horizon is part of the Phase C render-manager migration.

## Moving layers: diff/patch render managers

Aircraft, vessels and satellites now render through `MovingLayer`
(`lib/globe/render/`): a persistent `CustomDataSource` diffed by id so entity
identity survives polls, with per-frame `CallbackPositionProperty` motion
(dead-reckon for ADS-B/AIS, SGP4 for sats) eased frame-rate-independently. This
replaced the per-poll teardown that used to teleport them. Built-in clustering
is kept for aircraft + vessels. See `ARCHITECTURE.md` → "Moving layers".

Static layers (events, news, weather, conflict, country borders) still use plain
Entity `CustomDataSource`s rebuilt per poll — benign (they don't move, poll
slowly), pending a generic point manager in Phase C.

## Entity vs GPU primitives (Phase C)

The diff/patch managers are still over the **Entity API**, which is correct and
smooth at today's volumes (hundreds–low-thousands). Mass scale (10k+ aircraft,
20k+ sats) needs GPU-friendly primitive collections (`BufferPointCollection`,
`GeoJsonPrimitive`, batched polylines) — the Phase C migration, benchmarked
against this Entity baseline with the same dev panel before cutover (§12 §74).

## Dev diagnostics — `components/globe/PerfPanel.tsx`

Shown only with `?perf=1` or in dev. Reads the governor's live stats and the
camera altitude: FPS, frame time, effective vs ceiling quality, camera
moving/idle, primitive count. Pointer-events-none, never ships enabled (§117).
