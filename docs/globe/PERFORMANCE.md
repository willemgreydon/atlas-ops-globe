# Globe Performance

## Governor (mission §4) — `lib/globe/performance.ts`

`GlobePerformanceManager` samples real frame time off `scene.postRender`, keeps a
smoothed FPS (EMA, α=0.1), and moves the **effective** quality preset along the
degrade ladder `ultra → high → balanced → performance` to hold a frame budget.
It never renders above the user's chosen **ceiling**.

Hysteresis (no visible oscillation, §4):

| Condition | Dwell | Action |
|---|---|---|
| smoothed FPS < 34 | 1.5 s | drop one ladder step |
| smoothed FPS > 57 | 4.0 s | recover one step (never above ceiling) |
| 34 ≤ FPS ≤ 57 | — | hold |

- 2.5 s warm-up is ignored while terrain/imagery tiles stream in.
- Degrading re-applies only the frame-budget knobs (`applyQuality`): resolution
  scale, MSAA, FXAA, terrain SSE, tile cache, fog — not atmosphere character.
- User can lock the governor (`setAuto(false)`) → renders at the ceiling.
- Listener notifications throttled to ~4 Hz for the UI.

## Quality presets (mission §3) — `lib/globe/quality.ts`

Effective pixel ratio = `min(devicePixelRatio, maxPixelRatio) × resolutionScale`,
so we never super-sample beyond native unless explicitly opted in (§71).

| Preset | resScale | maxPR | MSAA | FXAA | SSE | maxLabels | particles |
|---|---|---|---|---|---|---|---|
| performance | 0.75 | 1 | 1 | off | 4 | 40 | 0 |
| balanced | 1 | 1.5 | 1 | on | 2.5 | 80 | 2 |
| high | 1 | 2 | 4 | on | 2 | 140 | 6 |
| ultra | 1 | 2 | 8 | on | 1.5 | 240 | 12 |

Default is auto-detected from `deviceMemory`/`hardwareConcurrency`/mobile UA
(→ performance/balanced/high). Ultra is opt-in for demos/screenshots.

## Benchmarks (mission §115 §161)

**Policy:** only measured numbers are recorded here. GPU-representative numbers
require a real browser on the target GPU (`/?perf=1` shows the dev panel). The
CI/headless environment renders via **SwiftShader (software, CPU)** — those
numbers are a floor for correctness, never a GPU target, and are labelled as such.

### Baseline captured this pass

| Env | Scene | GL | FPS | Frame |
|---|---|---|---|---|
| Headless Chromium | Global view, live feeds (hundreds of entities) | ANGLE/Vulkan **SwiftShader (software)** | ~18 | ~56.8 ms |

### Motion correctness probe (render managers)

| Layer | Entities | Sample | Result |
|---|---|---|---|
| Satellites (SGP4) | 500 | mid-list satellite, Δt = 1.5 s | **moved 11 324 m** (≈7.5 km/s, LEO orbital velocity) |

Validates the diff/patch `MovingLayer` + `CallbackPositionProperty` pipeline:
entities are created with preserved identity and **move continuously** rather
than teleporting on poll (mission §21 §109). Deterministic (SGP4 from vault
TLEs, no external key), so it is a reliable regression signal. Probe exposed via
`window.__globe` (dev-only).

Orbit geometry is also unit-tested deterministically against a real ISS TLE
(`tests/globe/orbits.test.ts`): a full past+future arc with a shared join point,
all samples at ISS altitude (~340–450 km), period ~92 min.

Interpretation: the ~18 FPS figure is CPU rasterization with no GPU. It confirms
the governor + perf panel sample and update correctly (the panel showed live FPS,
camera altitude 26 056 km, primitive count, effective quality). It does **not**
characterize real-GPU performance — that row will be filled from a hardware
session.

### Scenario matrix (to be measured on target GPU)

| # | Scenario | Entity baseline (FPS) | Primitive renderer (FPS) |
|---|---|---|---|
| A | 10k aircraft | _pending_ | _pending (Phase C)_ |
| B | 50k event points | _pending_ | _pending_ |
| C | 10k vessels + trails | _pending_ | _pending_ |
| D | 20k satellites | _pending_ | _pending_ |
| E | 3D city + 2k local entities | _pending_ | _pending_ |

The Entity-vs-Primitive comparison is the acceptance gate for the Phase C
migration (mission §74 §161): the primitive path must beat the Entity path on the
same scene with the same dev panel before the old path is removed.

## Targets (mission §116)

- 60 FPS normal operation on modern desktop.
- > 45 FPS in high-density views.
- No multi-second UI freezes; camera input stays responsive.
- Data correctness is never traded for FPS (mission §154).
