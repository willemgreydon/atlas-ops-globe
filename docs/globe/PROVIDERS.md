# Providers & Cost

The globe must work with **zero premium credentials** (mission §120 §163 §164).
Everything below degrades gracefully.

## Cesium version decision

`cesium@1.144.0` is installed. It already exposes every API the mission targets
(atmosphere scattering, particle systems, post-processing, terrain, 3D Tiles +
metadata, time-dynamic properties, CZML). **No upgrade** is performed now to keep
the tree runnable (§165); revisit only when a specific capability requires a newer
release. Runtime assets are copied to `public/cesium` by `scripts/copy-cesium.mjs`
(`CESIUM_BASE_URL = /cesium/`).

## Current providers

| Provider | Used for | Auth | Status without key |
|---|---|---|---|
| OpenStreetMap raster | Base imagery | none | ✅ works (mind tile-usage policy) |
| Cesium ion | World Terrain, ion imagery, OSM Buildings | `NEXT_PUBLIC_CESIUM_ION_TOKEN` | ⚠️ **absent here** → ellipsoid, no terrain |
| Google Photorealistic 3D Tiles | City digital-twin (§10) | Google Maps key (billed) | ⛔ not configured; optional |

`Ion.defaultAccessToken` is set only if the env var is present. No premium
provider is assumed free.

## Fallback ladder (mission §120)

```
Photorealistic 3D unavailable → Cesium World Terrain + imagery
World Terrain unavailable      → ellipsoid + OSM imagery      ← current state
Imagery unavailable            → neutral globe base color (#0a1016)
```

Data layers work at every rung.

## Planned provider abstraction (Phase B)

- **Basemap presets** (§122): Intelligence Dark, Satellite, Terrain, Clean,
  Photorealistic — a small provider factory so switching is smooth and
  credential-gated.
- **Terrain provider abstraction** (§9): World Terrain when ion is present, an
  open alternative otherwise, ellipsoid as floor.
- **Provider status surface** (§121): online / degraded / offline per provider
  (terrain, imagery, photorealistic, weather).

## Cost visibility

Photorealistic 3D Tiles and ion assets are **billed**. Before any is enabled by
default we document auth, pricing, limits, licensing, and the fallback here, and
gate it behind explicit config. The mission is explicit: never assume usage is
free (§10 §163).

## Live data feeds (existing, unchanged this pass)

ADS-B (OpenSky), USGS + NASA EONET, GDELT/NewsAPI/EventRegistry, ACLED,
Open-Meteo, Finnhub, MarineTraffic, Space-Track/CelesTrak (SGP4), OFAC, CISA
KEV/NVD — all provenance-tagged via `FeedMeta`; layers requiring an absent key
render disabled rather than faked.
