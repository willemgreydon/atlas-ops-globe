# Effects

Status: **design + budget defined**, registry lands in Phase E. The quality
presets already cap effect cost (`maxParticleSystems`, `trailSamples`), and the
performance governor is the authority that can disable expensive effects.

## Effect registry (mission §130) — planned interface

```ts
interface GlobeEffect {
  id: string;
  cost: "cheap" | "moderate" | "expensive";
  enable(): void;
  disable(): void;
  update?(time: JulianDate): void;
}
```

All effects register centrally so the governor and reduced-motion can control
them uniformly. `update(time)` binds every temporal effect to `viewer.clock`
(one clock, mission §56).

## Cost budget (mission §126)

| Effect | Cost |
|---|---|
| simple pulse (alert arrival) | cheap |
| geodesic route arc | cheap–moderate |
| global heatmap | moderate |
| particle wind field | expensive |
| photorealistic city | expensive |
| local precipitation / smoke particles | expensive |

Governor policy: reduced-motion or low FPS → disable all `expensive`, then
`moderate`; `cheap` single-shot pulses may remain.

## Rules that constrain every effect (mission §127 §128 §129)

An effect ships only if it improves spatial understanding, or communicates
state / time / movement / uncertainty / orientation. No decorative sci-fi grids,
no perpetual glow, no random ambient particles, no motion implying false
precision. Alerts: appear → **single** radar pulse → settle (never blink, §61).

## Shipped

- **Selection focus overlay** (`lib/globe/render/focus.ts`, mission §61 §62) —
  a following white halo + altitude stem, with a single expand-and-fade radar
  pulse on appear (settles, never blinks; suppressed under reduced motion). A
  `cheap` effect. Verified: satellite selection → halo + stem (pulse settled) +
  orbit trail.
- **Satellite orbit trail + ground track** (`lib/globe/render/orbits.ts`,
  mission §50 §52) — on selecting a satellite, its analytic SGP4 orbit is drawn
  ±½ period around now: past arc faded, future arc bright (straight ECEF
  segments in space), plus the dashed sub-satellite ground track clamped to the
  surface. Resampled at 1 Hz so the arcs slide with real time. The sampling core
  (`sampleOrbitGeodetic`) is pure and unit-tested against a real ISS TLE
  (`tests/globe/orbits.test.ts`).

## Planned effect set

Aircraft/vessel trails (history / velocity-fade / altitude-gradient), geodesic
route arcs with directional travel, news-arrival radial pulse, earthquake
seismic ring + depth stem, storm path + cone, wildfire perimeter + smoke,
wind/ocean particle advection, selection halo/outline. Each is a `GlobeEffect`.
