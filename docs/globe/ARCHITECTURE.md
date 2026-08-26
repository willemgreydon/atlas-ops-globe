# Globe Architecture

> Living doc. Reflects the engine after Phase A (control plane + cinematic scene
> + camera + performance governor). Data-layer render managers land in Phase C.

## Layers of the system

```
                     stores/app-store.tsx  (React state: mode, layers, feeds,
                        │                    quality, atmosphere, lighting)
                        │  props / context
        ┌───────────────┴───────────────────────────────┐
        ▼                                                ▼
 components/globe/Globe.tsx                     components/panels/* , TopBar,
   (React↔Cesium boundary)                       CommandPalette, PerfPanel
        │ imperative                                     │ read/write store
        ▼                                                ▼
 ┌──────────────────────────────┐            lib/globe/runtime.ts  (module-level
 │ lib/globe/                    │◀───────────  registry: one viewer + managers)
 │  quality.ts     presets       │
 │  scene.ts       cinematic cfg │
 │  performance.ts FPS governor  │
 │  camera.ts      flight/orbit  │
 │  runtime.ts     registry      │
 └──────────────────────────────┘
        │ owns
        ▼
   Cesium Viewer (single instance, mission §113)
```

## The React ↔ Cesium contract (mission §111)

React owns **application state** only: which mode, which layers, feed rows,
quality ceiling, atmosphere/lighting choice, selection. It must never reconcile
thousands of Cesium objects per frame.

`Globe.tsx` is the **only** bridge. It:
1. waits for Resium to create the viewer (RAF poll → `ready`),
2. on `ready`, runs a **create-once bootstrap** effect: sets the ion token if
   present, configures the cinematic scene, constructs the `GlobeCameraController`
   and `GlobePerformanceManager`, publishes them into `runtime.ts`, and installs
   the single pick/hover `ScreenSpaceEventHandler`,
3. runs a **config-reaction** effect that re-applies scene config + governor
   ceiling when quality/atmosphere/lighting/autoQuality change,
4. runs one effect **per data layer** that builds Cesium entities.

Config values consumed by the create-once bootstrap are read through a
`configRef` (updated in its own effect) so the bootstrap never lists them as
dependencies and never re-runs — the managers are constructed exactly once per
viewer lifetime, and disposed on unmount.

### Moving layers — resolved (diff/patch render managers)

The audit's #1 weakness (teardown+rebuild per poll → teleport) is **fixed for
every moving layer**. `lib/globe/render/motion.ts` provides `MovingLayer`, a
persistent `CustomDataSource` that **diffs incoming rows by id** — updating in
place, adding new, removing gone — so object identity survives polls. Motion is
honest: `sample(row, now)` returns the dead-reckoned (ADS-B/AIS) or SGP4 (sats)
target, and a per-frame `CallbackPositionProperty` eases the rendered position
toward it (frame-rate-independent smoothing; snaps only on large corrections).
Factories in `lib/globe/render/layers.ts`: `createAircraftLayer`,
`createVesselLayer`, `createSatelliteLayer`.

**Measured:** 500 satellites, a sampled satellite moved 11 324 m in 1.5 s
(≈LEO orbital velocity) — continuous motion, no teleport (see `PERFORMANCE.md`).

In `Globe.tsx` each moving layer is two effects: a **lifecycle** effect
(`[ready, layerOn, …]`) that constructs/mounts/disposes the manager exactly
once per enablement, and a **data** effect (`[rows]`) that calls
`layer.update(rows)`. A `rowsRef` seeds the manager on creation so it fills
immediately without waiting for the next poll.

### Remaining debt

- **Static layers** (events, news, weather, conflict, countries) still rebuild
  their datasource per poll. Benign today — they don't move and poll slowly
  (60–120 s) — but they'll move to a generic diff/patch point manager in Phase C.
- **GPU primitives.** Moving layers use diff/patch over the *Entity* API, which
  is correct and smooth at today's volumes (hundreds–low-thousands). Mass scale
  (10k+ aircraft, 20k+ sats) still needs primitive collections
  (`BufferPointCollection`, batched polylines) — the Phase C migration,
  benchmarked against this Entity baseline before cutover (mission §12 §74 §112).

## Module responsibilities

| Module | Owns | Never does |
|---|---|---|
| `quality.ts` | Preset definitions, DPR math, auto-detect | Touch the viewer |
| `scene.ts` | Atmosphere/lighting/fog/quality application | Hold state |
| `performance.ts` | FPS sampling, hysteresis, live degradation | Exceed the user's ceiling |
| `camera.ts` | Flight verbs, easing, damping, auto-orbit | Fetch data |
| `runtime.ts` | Single source of truth for the live managers | Own lifecycle |
| `Globe.tsx` | Lifecycle, picking, layer effects | Business logic |

## Single-viewer invariant

There is one Cesium `Viewer`, created by one `<Viewer>` (Resium). `runtime.ts`
holds at most one `GlobeRuntime`. Any code needing the viewer/camera/governor
reads it from the registry (`getGlobeRuntime`/`onGlobeRuntime`), never by
creating its own.

## Disposal (mission §114)

The bootstrap effect's cleanup: destroys the pick handler, clears the runtime,
disposes the performance manager (removes render/camera event listeners) and the
camera controller (removes idle-orbit listeners + tick). Each per-layer effect
removes its datasource. No timers, listeners, or subscriptions outlive the
viewer.
