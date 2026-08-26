# Visual System

The visual grammar of the globe (mission §32 §125 §127). Status: **codifying**
what already exists; the full grammar is built out with the render managers.

## Colour tokens (in use today, `lib/config/layers.ts` + `Globe.tsx`)

| Meaning | Colour |
|---|---|
| Aircraft | `#65f6c7` |
| Maritime | `#4fd6d1` |
| News | `#54c7ff` |
| Conflict | `#ff5a62` |
| Earthquakes | `#ffae45` |
| Natural events | `#ff8a5b` |
| Weather | `#9ad7ff` |
| Satellites (LEO/MEO/GEO) | `#65f6c7` / `#54c7ff` / `#ffd166` |
| Country borders | `#8aa0b6` |

### Severity ramp (events)

`critical #ff5a62` · `warning #ffae45` · `watch #54c7ff` · `info #65f6c7`.
Size also encodes severity (critical 14 px → info 9 px) so colour is never the
sole channel (mission §32 "do not rely only on colour").

## Marker grammar (target, mission §32)

Each domain must be distinguishable by **shape + icon + animation**, not colour
alone. Planned mapping (icon atlas, §83): earthquake (ring), fire (flame),
flood, storm (spiral), conflict (cross), news (dot), cyber, infrastructure
(square), sanctions. Built with the event render manager in Phase E.

## Scale & screen-space (mission §137 §138)

- All symbols scale by camera range via `NearFarScalar` (already applied to
  aircraft billboards and satellite points).
- Selected objects keep a minimum pixel size so they never vanish.
- Distance-based scaling prevents huge icons covering whole cities.

## Selection (mission §61 §62) — implemented

`FocusOverlay` (`lib/globe/render/focus.ts`) draws a **white halo** (high
contrast against any imagery, §62) that FOLLOWS the selected entity by sharing
its live position property, plus an **altitude stem** to the surface for
aircraft/satellites. On appear, a **single radar pulse** expands and fades once,
then settles — never a continuous blink (§61); suppressed under reduced motion
(§60). Works for aircraft, vessels, satellites (live position) and
event/news/weather (fixed point). Verified end-to-end: selecting a satellite
yields halo + stem (2 entities, pulse already settled) + a 3-polyline orbit
trail.

### Hover (mission §63) — planned

Subtle scale + outline + compact tooltip, no network fetch on mouse-move. The
pick handler already sets the pointer cursor; the tooltip is next.

## Freshness (mission §108) — planned

Live entities communicate age: fresh = full opacity, aging = reduced, stale =
muted/dashed. Never silently drop stale data. Driven by `FeedMeta.fetchedAt` +
per-entity observation timestamps once render managers own entity identity.

## Opacity / layer order (mission §88 §89)

Target composition order (bottom→top): base imagery, terrain, raster weather,
country fill, infrastructure geometry, tracks, entities, alerts, labels,
selection. Each layer exposes opacity/priority. Formalized in Phase C.
