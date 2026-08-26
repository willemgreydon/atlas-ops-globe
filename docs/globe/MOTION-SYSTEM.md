# Motion System

Standard durations and easing for every animated surface on the globe (mission
§59). Consistency is the point: the same *kind* of change always takes the same
time and eases the same way.

## Durations

| Class | Duration | Used for |
|---|---|---|
| Micro interaction | 120–180 ms | hover scale, button/toggle feedback |
| Panel transition | 180–260 ms | inspector open/close, layer panel |
| Map highlight | 300–500 ms | selection halo, marker emphasis |
| Local flyTo | 700–1200 ms | city / event / vessel / infra framing |
| Country flyTo | 1200–1800 ms | continental → country descent |
| Global flyTo | 1800–3000 ms | orbital / antipodal travel |

The camera controller computes flight duration continuously from angular travel
(0.7 s → 3.0 s), which lands inside these bands rather than snapping to three
fixed values — the table is the design intent the continuous model honours.

## Easing

- **Camera flight:** `QUINTIC_IN_OUT` — long, cinematic settle.
- **De-cluster zoom:** `QUINTIC_IN_OUT`, fixed 0.8 s.
- **UI micro/panel:** CSS `cubic-bezier(0.4, 0, 0.2, 1)` (standard).
- **Alerts / pulses (planned):** ease-out expansion, ease-in fade — single shot.

## Reduced motion (mission §60)

Under `prefers-reduced-motion: reduce`:
- camera flights become instant (`duration 0`),
- idle auto-orbit is disabled,
- decorative pulses/particles are suppressed (enforced by the effect registry in
  Phase E — cost-gated so reduced-motion simply disables the "cheap pulse" and
  all "expensive" effects),
- core tracking/interpolation stays fully functional.

The camera controller already reads the media query on construction and via
`setReducedMotion`.

## Motion priorities (mission §129)

Motion must mean something. Allowed: aircraft/ships/satellites moving, storms
moving, wind flowing, time replay, a single new-alert arrival. Forbidden:
continuously pulsing UI, glowing borders everywhere, random ambient particles
(mission §127 §128).
