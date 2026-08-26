# Globe Engine Roadmap

Tracks the mission's phase plan (§155). ✅ done · 🚧 in progress · ⬜ planned.

## Phase A — Engine ✅ (this pass)

- ✅ Engine audit → `GLOBE-AUDIT.md`
- ✅ Cesium upgrade review → stay on 1.144 (decision in `PROVIDERS.md`)
- ✅ Quality presets (`lib/globe/quality.ts`, 4 modes, DPR-aware)
- ✅ Cinematic scene config (`lib/globe/scene.ts`, atmosphere + lighting presets)
- ✅ Camera controller (`lib/globe/camera.ts`, cinematic flyTo, damping, auto-orbit, reduced-motion)
- ✅ Performance governor (`lib/globe/performance.ts`, FPS hysteresis, live degradation)
- ✅ Runtime registry (`lib/globe/runtime.ts`, single viewer/managers)
- ✅ Dev diagnostics panel (`PerfPanel.tsx`, `?perf=1`)
- ✅ Store wiring (quality/atmosphere/lighting/autoQuality)
- ✅ Docs set + tests (unit + Playwright green, build green)

## Phase B — Earth 🚧

- ✅ Quality / atmosphere / lighting UI controls + auto-quality toggle
  (`components/panels/GlobeSettings.tsx`) — every control drives real engine
  state, verified by an e2e that reads `scene.globe.maximumScreenSpaceError`.
- ✅ Celestial environment (§8) — real Tycho-2 starfield skybox + sun + moon +
  HDR bloom + camera lens flare (`lib/globe/render/celestial.ts`), quality-gated,
  offline (bundled Cesium assets), toggle in `GlobeSettings`. e2e-verified via
  `scene.skyBox.show`.
- ✅ Terrain provider abstraction + premium surfaces (§9) — `TerrainController`
  (`lib/globe/terrain.ts`) switches between the ellipsoid, Cesium **World Terrain**
  (real relief), and Google **Photorealistic 3D Tiles**, all gated behind
  `NEXT_PUBLIC_CESIUM_ION_TOKEN`. Defensive: bad/expired token or network failure
  falls back to the ellipsoid without killing the render loop (runtime-verified);
  a generation guard discards superseded async loads. Cesium-free config lives in
  `terrain-config.ts` so the SSR graph never pulls the cesium bundle. UI: a
  token-gated "Surface" control in `GlobeSettings`.
- ⬜ Basemap imagery presets (§122), provider status surface (§121).

## Phase C — Mass data 🚧

- ✅ Render-manager architecture — `MovingLayer` diff/patch by id, identity
  preserved across polls (`lib/globe/render/motion.ts`).
- ✅ Position interpolation (§21 §109) — dead-reckon (ADS-B/AIS) + SGP4 (sats)
  via `CallbackPositionProperty` with frame-rate-independent easing; verified by
  the satellite motion probe (`PERFORMANCE.md`).
- ✅ Aircraft / vessel / satellite managers (`lib/globe/render/layers.ts`);
  satellites now propagate continuously off wall-clock (old 3 s `setInterval`
  jump removed).
- ⬜ GPU primitive collections for mass scale (BufferPointCollection, batched
  polylines) benchmarked vs the Entity baseline (§12 §74 §112).
- ✅ LOD bands + declutter engine (§14 §64 §104 §106) — `LodController`
  (`lib/globe/lod.ts`) samples camera height off the render loop and drives
  altitude-banded layer visibility (fine ground layers hide from orbit) plus a
  quality-preset label budget (nearest-N labels kept, rest hidden). Pure core
  unit-tested (`tests/globe/lod.test.ts`); e2e-verified via the live camera
  altitude → band. Band surfaced in the dev perf panel. Closes audit **W3**.
- ⬜ Static-layer diff/patch (events/news/weather), GeoJsonPrimitive + MVT
  (§13 §74 §75), camera-driven viewport fetching (§78 §79).

## Phase D — Live mobility 🚧

- ✅ Focus mode (fly-to) — selecting an entity flies to it via the semantic
  camera verbs (`Globe.tsx` focus effect, `feedsRef`).
- ✅ Live history trails (§22 §25) — fading, tapered comet-trail follows the
  selected aircraft/vessel/satellite, sampling the already-smoothed rendered
  position into a rolling buffer capped by `QualitySettings.trailSamples`
  (`lib/globe/render/trails.ts`). Colour/gate swap per domain.
- ⬜ Smooth aircraft LOD model swap, density modes / corridors (§24), geodesic
  route arcs (§27 §28), continuous target *follow* + non-focus layer fade (§19),
  trails for all (not just selected) moving entities.

## Phase E — Environment 🚧

- ✅ Disaster viz — earthquake/alert shockwave rings (§34 §37): magnitude-scaled
  expanding+fading ground ripples on quakes and critical/warning events, a
  diff/patched effect layer with a severity-ranked ceiling
  (`lib/globe/render/effects.ts`, unit-tested pure core). Seeds the effect
  registry (§130).
- ⬜ Weather raster + animation (§38 §131), wind field (§40), clouds,
  precipitation, air quality (§42), heatmap engine + H3 (§43 §44), storm cone +
  wildfire (§35 §36), full particle engine (§37).

## Phase F — Space 🚧

- ✅ Orbit paths + ground tracks (§52) for the selected satellite (past/future
  arcs + dashed ground track, SGP4, `lib/globe/render/orbits.ts`).
- ✅ Continuous SGP4 motion (§51) via the satellite render manager.
- ✅ Coverage cones (§53) — translucent 3D sensor cone (Cesium `cylinder`,
  `topRadius = 0`) hung under the selected satellite, apex at the craft, base a
  ground footprint; follows the live position (`lib/globe/render/coverage.ts`).
- ⬜ Drive SGP4 off `viewer.clock` for replay (§56), constellation filters (§54),
  debris (§55), space transition (§148). Time/4D controller + replay +
  scrubbing (§56 §57 §58).

## Phase G — Cinematic polish 🚧

- ✅ Selection effects (§62) — following halo + altitude stem + single radar
  pulse (`lib/globe/render/focus.ts`).
- ✅ Hover tooltip (§63) — cursor-following identity readout for any pickable
  feature (aircraft/vessel/satellite/event/news/weather/country/cluster) via a
  low-overhead pub/sub channel that bypasses React context re-renders
  (`lib/globe/hover.ts`, `components/globe/GlobeTooltip.tsx`).
- ⬜ Camera bookmarks (§17), presentation mode (§72), cinematic demo sequences
  (§73), motion tuning, high-DPI export (§71).

## Milestones

- **M1 (§156):** premium Earth, realtime day/night, atmosphere, terrain,
  imagery, smooth camera, quality presets, smooth live aircraft + fading trails,
  event markers, news clusters, earthquake effects, weather overlay, focus,
  fly-to, FPS governor, LOD, label declutter. → Phases A–E core.
  Phase A control plane + camera + scene are in place; remaining M1 items are
  the render-manager-dependent visuals (Phases C–E).
- **M2 (§157):** vessels, shipping density, wind, pollution, photorealistic
  cities, 3D infra, satellites, orbital trails, replay timeline.
- **M3 (§158):** geofence editor, visual query, H3, spatial aggregation,
  investigation mode, 3D-Tiles metadata, analysis tools, presentation mode.
