# 01 — Performance Baseline

**Status:** CURRENT · **Date:** 2026-08-26 · **Branch:** `master` @ `80be17e`

> Ground rule (brief §3, §42): **never claim an optimization improved performance without a measurement to compare against.** This document records the numbers that exist *today*, before any optimization work. Metrics I could measure statically are recorded with their method. Runtime metrics that require an instrumented browser session are marked **NOT YET MEASURED** — they are deliberately left blank rather than estimated, so no future "improvement" is measured against a fabricated baseline.

---

## 1. Build & bundle (measured)

Method: `pnpm build` (Next 16.3.1, Turbopack) + `du` over `.next/static` and `public/cesium`.

| Metric | Value | Notes |
|---|---|---|
| Production build | ✅ compiles in 351 ms; TS check 881 ms | 21 routes (1 static `/`, 20 dynamic API) |
| Largest client JS chunk | **≈ 4.6 MB** (`.next/static/chunks/0t9g207r088ju.js`, 4,596 KB) | The Cesium engine, **statically imported** — dominates first load |
| 2nd/3rd client chunks | 252 KB, 224 KB | app + vendor |
| Cesium runtime assets (served from `public/`) | **7.5 MB** | Assets 4.6 MB · Workers 1.3 MB · ThirdParty 1.1 MB · Widgets 652 KB |
| `.next` total | 651 MB | dev+build artifacts, not shipped |

**Baseline observation:** the ~4.6 MB Cesium chunk is a static import, so it is on the critical path to first globe render. Code-splitting/lazy-loading Cesium (dynamic import behind the loading state) is the obvious first lever — but **must be measured** via the runtime metrics below, not assumed.

---

## 2. Live data volumes (measured)

Method: `node:sqlite` count queries against `data/intelligence.db` (20.1 MB).

| Table | Rows | Table | Rows |
|---|---:|---|---:|
| sanctions | 19,249 | provenance | 2,463 |
| space_objects | 3,900 | relationships | 413 |
| entities | 305 | news_articles | 158 |
| events | 131 | vessels | 0 |
| change_log | **0** | | |

Notes: `vessels=0` (no maritime sync run recently); `change_log=0` (defined, no writer — see audit P3-9); provenance covers ~2.5k of ~24k total stored records (see audit P0-4).

---

## 3. Polling & fetch cadence (measured)

Method: `stores/app-store.tsx:175` (`POLL_MS`) + feed wiring `:327-339`.

| Feed | Interval | Fetch cap | Route |
|---|---|---|---|
| aircraft | 15 s | (server) | `/api/aircraft` |
| vessels | 30 s | 500 | `/api/intelligence/maritime?limit=500` |
| markets | 30 s | 20 | `/api/intelligence/markets?limit=20` |
| events | 60 s | (server) | `/api/events` |
| vault snapshot | 60 s | — | `/api/intelligence/stats` |
| news | 120 s | (server) | `/api/news` |
| conflict | 120 s | 500 | `/api/intelligence/events?kind=conflict&limit=500` |
| weather | 600 s | 200 | `/api/intelligence/weather?limit=200` |
| satellites | 1800 s | 900 | `/api/intelligence/space?limit=900` |

**Baseline observations:**
- No feed pauses when the tab is hidden (audit P2-1) — worst case an idle background tab issues ~4 aircraft + 2 vessel + 2 market requests/minute indefinitely.
- Highest render-load layers by count: **satellites (900), vessels/conflict (500 each)** — all on the Entity API (audit P1-5). These are the primitive-migration candidates.

---

## 4. Runtime metrics — **NOT YET MEASURED**

These require an instrumented browser session (Chrome DevTools Performance panel + a Cesium `scene.debugShowFramesPerSecond` capture, or a Playwright trace with `performance.measureUserAgentSpecificMemory`). They are **intentionally blank** — filling them with estimates would corrupt the baseline.

Desktop (standard + high-DPR), to be captured before any Phase-A perf change:
- [ ] Initial JS transferred (network, cold) & Cesium payload share
- [ ] First meaningful globe render (ms)
- [ ] Time to interactive (ms)
- [ ] Idle FPS
- [ ] FPS with representative layers on (aircraft+events+news+satellites)
- [ ] FPS during camera fly-to
- [ ] FPS tracking a selected moving object
- [ ] Primitive/entity count at steady state
- [ ] DOM node count
- [ ] JS heap over a 30-min session (leak check)
- [ ] Re-renders per feed tick (React Profiler) — expected high, see audit P1-7

Mobile (low/mid device profile): repeat FPS-with-layers, first render, TTI, heap-over-time.

### How to capture (proposed harness)
A `docs/engineering/perf/` script that (1) launches the app via Playwright, (2) enables `scene.debugShowFramesPerSecond`, (3) drives a fixed camera choreography with a known layer set, (4) samples FPS + `performance.memory` at intervals, (5) writes a JSON snapshot stamped with commit SHA. This makes every future "+X FPS" claim reproducible and diffable. **Not yet built** — recommended as the first task of any performance-focused phase so that Phase-A/B work (visibility gate, scratch-vector, Cesium code-split, primitive migration) can be measured, not asserted.

---

## 5. Baseline summary

What is known today, quantitatively:
- **~4.6 MB static Cesium chunk** on the first-render critical path.
- **~24k stored records**, provenance covering ~2.5k of them.
- **9 independent poll loops**, none visibility-gated, feeding a **single React context** that re-renders the whole tree on every tick.
- **Highest-count live layers: 900 satellites / 500 vessels / 500 conflict**, all Entity-API.

What is unknown and must be instrumented before optimization claims: **all runtime FPS, memory, and render-count numbers.** The next performance action is to build the capture harness in §4 and fill the table — then, and only then, optimize.
