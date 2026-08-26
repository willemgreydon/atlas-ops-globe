# Globe Engine Audit — Baseline

> Date: 2026-08-20 · Branch: `master` · Auditor: engine upgrade pass (Phase A).
> This is the honest baseline snapshot taken **before** any rendering changes,
> per mission step 1. Numbers marked _(unmeasured)_ require a real GPU browser
> session — the headless CI environment cannot report trustworthy FPS, so they
> are deliberately left open rather than faked (mission §161/§154).

## 1. What exists today

| Concern | Current state |
|---|---|
| Cesium | `cesium@1.144.0` installed (`^1.134.0` in `package.json`). Recent — **no upgrade blocker**. |
| Resium | `resium@1.25.0`. Used only for `<Viewer>` + `<ImageryLayer>`. |
| Renderer entry | Single component `components/globe/Globe.tsx` (464 lines). |
| Viewer lifecycle | Created by Resium `<Viewer>`; readiness detected by polling `ref.current.cesiumElement` in a `requestAnimationFrame` loop → `ready` flag. |
| Imagery | `OpenStreetMapImageryProvider` (raster), `alpha 0.7 · brightness 0.62`. No ion. |
| Terrain | **None** — smooth ellipsoid (`EllipsoidTerrainProvider` default). |
| Atmosphere | `showGroundAtmosphere = true`, `skyAtmosphere.show = true`, `enableLighting = true`. No scattering tuning. |
| Base color | `#0a1016` globe, `#05070a` background. |
| Entities | 100% **Entity API** via `CustomDataSource` / `GeoJsonDataSource`. No primitives. |
| Clustering | Built-in Cesium clustering on aircraft + vessels (`pixelRange 28`). |
| Markers | Canvas sprites (aircraft arrow, cluster discs) + `point`/`label` graphics. |
| Satellites | SGP4 via lazy `satellite.js`; `ConstantPositionProperty` updated on a 3 s `setInterval` (up to 900 sats). |
| Camera | Two naive helpers: `flyTo` (fixed 2.5 Mm alt, 1.2 s) and `zoomTowardCursor` (0.8 s). No damping, no distance-adaptive duration, no follow/orbit. |
| Picking | One `ScreenSpaceEventHandler`: `LEFT_CLICK` → `scene.pick` → `selectionMap` WeakMap → store `select`. `MOUSE_MOVE` → cursor. |
| Day/night | `enableLighting` on, but clock is Cesium default (real UTC) with no explicit control surface. |
| Quality presets | **None.** |
| Performance governor | **None.** |
| LOD | **None** — every row of every enabled layer is rendered at all altitudes. |
| Label manager | **None** — labels are per-entity, no collision/priority policy. |
| Time controller | **None** — `shouldAnimate` on, timeline/animation widgets disabled. |
| Effects | **None** — no pulses, particles, trails, arcs, post-processing. |
| Dev diagnostics | **None.** |

## 2. React ↔ Cesium boundary

Each layer is a `useEffect` keyed on `[ready, layers.X, feed.rows]`. On **every**
feed poll (aircraft 15 s, vessels 30 s, …) the effect:

1. tears down the entire `CustomDataSource` (`dataSources.remove(ds, true)`),
2. builds a brand-new `CustomDataSource`,
3. re-adds every entity from scratch.

**Consequence:** aircraft/vessels/satellites are destroyed and recreated wholesale
on each refresh — they **teleport**, never interpolate (mission §21/§109 explicitly
forbid this). No object identity is preserved across polls. This is the single
biggest architectural weakness.

The boundary itself is otherwise sound: effects read the live viewer imperatively
from the ref (not React state), and the React Compiler is respected by keeping
`configureScene` at module scope. The problem is **granularity** — full teardown
instead of diff/patch.

## 3. Strengths

- **Honest data model.** Every feed carries `FeedMeta` (status/source/cached/stale)
  — provenance-aware, no fake liveness. Planned layers render disabled, not faked.
- **Correct SGP4.** Real TLE → `satellite.js` propagation, positions computed not
  stored (mission §51 already satisfied).
- **Lazy code-split** of `satellite.js` keeps it out of the main bundle.
- **Sane picking** that avoids enumerating cluster entity arrays (documented crash
  avoidance) and de-clusters by zooming toward the ellipsoid pick.
- **Clean viewer config** — all chrome widgets disabled, single viewer, no leaks in
  the per-layer effects (each removes its datasource on cleanup).
- **Poll-gating** — a feed only polls when its layer is on (respects rate limits).

## 4. Weaknesses / bottlenecks

| # | Issue | Impact | Mission ref |
|---|---|---|---|
| W1 | Full datasource teardown+rebuild every poll | Teleporting entities, GC churn, no interpolation | §21 §109 §111 |
| W2 | Entity API for mass data | Won't scale to 10k+ aircraft / 20k sats | §12 §74 §112 |
| W3 | No LOD / decluttering | Everything renders at every altitude → visual noise + wasted draw | §14 §104 §106 |
| W4 | No quality presets | Can't adapt to weak vs strong GPUs | §3 |
| W5 | No performance governor | No adaptive degradation; risk of low-FPS lock | §4 |
| W6 | No terrain | Flat Earth up close; no depth | §9 |
| W7 | Flat atmosphere/lighting | Not "cinematic"; default look | §5 §7 |
| W8 | Naive camera | Jump-cuts, no easing/damping/follow/orbit | §15 §16 §18 §19 |
| W9 | `satellite.js` on `setInterval(3s)` off the render clock | Sats jump every 3 s, decoupled from Cesium time; blocks timeline/replay | §51 §56 |
| W10 | No trails / arcs / effects | Missing core intelligence-viz vocabulary | §22 §27 §32 |
| W11 | No time/4D controller | No replay, no scrubbing, no day/night control surface | §56 §57 §58 |
| W12 | No dev diagnostics | Can't see FPS/primitive/entity counts to optimize | §117 |
| W13 | OSM raster imagery, no dark intelligence basemap abstraction | Look is generic; heavy OSM tile use discouraged by policy | §122 §123 |
| W14 | Reduced-motion not respected | Accessibility gap | §60 |

## 5. Rendering risks

- **Cluster enumeration crash** (already mitigated in click handler — must preserve).
- **Interval-driven satellite updates** race with viewer disposal on layer toggle
  (cleanup clears the interval, but propagation and disposal can interleave — the
  `cancelled` flag guards it; keep this invariant in any refactor).
- **`disableDepthTestDistance = Infinity` everywhere** → markers draw through the
  globe (objects on the far side show through). Violates occlusion (§65/§66).
  Acceptable for points-as-symbols but wrong for a "physically embedded" feel.
- Full-datasource rebuilds during camera flight can stutter the render loop.
- **Country-polygon tessellation overflow** (fixed): the 110m country GeoJSON
  carries long, near-antipodal edges (Antarctica, Russia) that make Cesium's
  `computeRhumbLineSubdivision` throw `RangeError: Too many properties to
  enumerate` once the camera pulls far out (e.g. flying to a high-orbit
  satellite), killing the whole render loop. Mitigated by forcing
  `ArcType.GEODESIC` + a coarse `granularity` on each loaded polygon
  (`Globe.tsx` country-borders effect). Preserve this when touching that loader.

## 6. Opportunities (ordered)

1. **Render-manager architecture** — one imperative owner per domain that diffs
   rows → primitives, preserving identity and interpolating position (kills W1+W2).
2. **Quality presets + performance governor** — the control plane every other
   feature reads (W4+W5). _Phase A, this pass._
3. **Cinematic scene** — atmosphere scattering, fog, dynamic lighting, day/night
   control (W6+W7+W11).
4. **Camera controller** — distance-adaptive cinematic `flyTo*`, damping, auto-orbit,
   focus mode (W8).
5. **LOD + declutter engine** — altitude-driven visibility + label priority (W3).
6. **Trails / arcs / effect registry** — the viz vocabulary (W10).
7. **Time/4D controller** — drive sats + everything off `viewer.clock` (W9+W11).

## 7. Benchmark baseline (methodology)

Scenarios (mission §115) to be measured in a real browser (`/?perf=1` dev panel,
added this pass) on the target desktop GPU. Recorded in `PERFORMANCE.md` as they
are taken — **not** estimated here.

- A: 10k aircraft · B: 50k event points · C: 10k vessels + trails ·
  D: 20k satellites · E: 3D city + 2k local entities.

Current live data volumes (from the running feeds) are far smaller
(hundreds–low-thousands), so today's globe is not yet stressed; the benchmarks
exist to validate the primitive-renderer migration (Phase C) against the Entity
baseline captured with the same dev panel.

## 8. Decision: no Cesium upgrade needed now

`1.144.0` already exposes the target APIs (atmosphere scattering knobs, particle
systems, post-processing, terrain, 3D Tiles, time-dynamic properties). Upgrading
to the very latest is deferred until a specific capability requires it, to keep
the tree runnable (mission §165). Recorded in `PROVIDERS.md`.
