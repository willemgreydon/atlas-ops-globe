# 00 — Current-State Forensic Audit

**Status:** CURRENT · **Date:** 2026-08-26 · **Branch:** `master` @ `80be17e`
**Method:** Read-only inspection of the full source tree (`app/`, `components/`, `lib/`, `stores/`, `intelligence/`, `data/`, `docs/`), the live `data/intelligence.db`, and the toolchain (`typecheck`, `test`, `lint`, `build`). Nothing was modified. Findings cite `file:line`.

> This document is evidence, not opinion. Every severity is justified. Where a worry from the briefing turned out to be *already handled*, that is stated explicitly — the goal is an accurate map, not a longer list.

---

## 1. Toolchain baseline (measured this pass)

| Gate | Result | Evidence |
|---|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | ✅ **PASS** (exit 0) | clean |
| `pnpm test` (`vitest run`) | ✅ **PASS** — 106 tests / 22 files, 925 ms | all green |
| `pnpm build` (`next build`, Turbopack) | ✅ **PASS** — Next 16.3.1, 21 routes | compiled 351 ms, TS 881 ms |
| `pnpm lint` (`eslint .`) | ❌ **FAIL** (exit 1) — **2 errors, 4 warnings** | see §2 |

**Correction to prior assumption:** an earlier run reported lint "clean" because the shell captured `tail`'s exit code across a pipe, not eslint's. Re-run with `PIPESTATUS` confirms eslint **fails**. This matters because §42 of the brief makes a green lint part of the Definition of Done.

---

## 2. Severity matrix (consolidated)

Severity legend — **P0** correctness/trust/security · **P1** architectural blocker · **P2** scale/perf/UX · **P3** polish/maintainability.

### P0 — correctness / trust / security

| ID | Finding | Evidence | Why P0 |
|---|---|---|---|
| **P0-1** | **`/api/intelligence/*` read routes surface no liveness/freshness** — stale vault rows are indistinguishable from live. | `app/api/intelligence/{disasters,events,space,cyber,sanctions,persons,organizations,countries}/route.ts` return `{data,page}` with no `status`/`fetchedAt`. The vault is only as fresh as the last `pnpm intel:sync` (`bin/intel.ts:89`). `maritime`/`markets` attach a `status` derived from **credential presence** (`finnhubConfigured()`), *not* data recency (`app/api/intelligence/markets/route.ts:12`). | Directly violates the core trust invariant (§38): stale data shown without staleness; "configured" ≠ "live". |
| **P0-2** | **Relationship provenance is structurally dropped** — all 413 live edges are unattributed. | `lib/intel/enrich.ts:20-24` always passes `provenance: []`; `upsertRelationship` (`lib/intel/repositories.ts:70-78`) stores it inline but never calls `insertProvenance()`. Live DB: `relationships=413`, none traceable. | "Why does Atlas believe this edge?" is unanswerable — breaks §9 provenance and §38 invariants. |
| **P0-3** | **Provider URLs rendered into `href` without scheme validation** (stored XSS via poisoned/malicious upstream). | `components/panels/Inspector.tsx:113` (`p.sourceUrl`), `:180` (news `url`), `components/panels/TrendingEntities.tsx:41`. Source schemas are `z.string()` not `.url()` (`lib/providers/gdelt.ts:15`, `lib/intel/providers/newsapi.ts:23`). A `javascript:` URL from a feed becomes a clickable payload. | Platform doctrine (§23) treats provider data as untrusted; the sink exists with no scheme guard. Exploitability requires a hostile/poisoned feed + user click — real, medium-likelihood. |
| **P0-4** | **Provenance table populated for only 5 of ~15 record types.** | Only `upsertEntity/Event/News/Vulnerability/Vessel` call `insertProvenance()` (`repositories.ts:67,96,114,132,208`). Sanctions (19,249 rows), space objects (3,900), persons, orgs, weather, markets store provenance only as inline JSON, never in the queryable `provenance` table. | Lineage chain (§9) is broken for the majority of stored intelligence. |

### P1 — architectural blockers

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| **P1-1** | **Lint fails on 2 React-Compiler `immutability` errors in `Globe.tsx`** — these *are* the "React Compiler violations" the brief references. | `Globe.tsx:502` (`feedsRef.current = {…}` — "`feedsRef` cannot be modified"), `Globe.tsx:522` (ref reassigned inside an effect that also lists it as a dep). `eslint-plugin-react-hooks` RC rules are active; `next.config.ts` has `reactStrictMode` but **not** `experimental.reactCompiler`. | Breaks Definition of Done (§42). The compiler itself is *not* enabled, so these are lint-level, not runtime — but they block the gate and signal a genuine ref-mutation-in-effect smell. |
| **P1-2** | **Two competing, non-shared provider abstractions.** | Live-fetch framework `lib/core/provider.ts` (`ProviderDefinition`/`runProvider`, honest `DataStatus`) vs. ingestion stack `lib/intel/providers/*` + `lib/intel/ingest.ts` (`success/partial/failed`). Different status vocabularies, caching, and rate-limiting. **GDELT is implemented twice** (`lib/providers/gdelt.ts` and `lib/intel/domains/news.ts:54`). | Every new provider must be reasoned about twice; trust semantics diverge across the two halves of the app. |
| **P1-3** | **Two provider registries that disagree on facts.** | `data/provider-registry.ts` (used by `/api/health`) vs. `lib/intel/sources.ts` (used by CLI). ACLED keys differ (`ACLED_CLIENT_ID/SECRET` vs. `ACLED_USERNAME/PASSWORD` — code uses the latter, `acled.ts:29`). Registry marks live providers (`nvd`, `openmeteo`, `finnhub`, `ofac`, `celestrak`) as `"planned"`. `/api/health` reports a wrong picture. | Violates §37 (canonical source registry); the health endpoint actively misleads. |
| **P1-4** | **No claim/observation layer — statements collapsed into records.** | No subject/predicate/object/basis/confidence Claim node anywhere (`lib/intel/schemas.ts`). "Observations" exist only as narrow value-rows (econ/weather/market). Cannot express "provider A asserts X, provider B disputes X". `VaultQuality.sourceAgreement` (`schemas.ts:33`) is defined but never computed. | The gap between "normalized record store" and "knowledge graph" (§8). Blocks claim-level provenance (§9) and corroboration. |
| **P1-5** | **100% Entity API — no GPU primitive collections.** | Every layer adds Cesium `Entity` to a `CustomDataSource`, including the two highest-volume: satellites (`?limit=900`, `app-store.tsx:338`) and vessels/conflict (`?limit=500`). Docs honestly mark `BufferPointCollection` as planned (`docs/globe/RENDERING.md:66`). | Cannot reach the 10k/20k targets the repo's own audit set (`docs/globe/GLOBE-AUDIT.md:125`). This is the §5 scale ceiling. |
| **P1-6** | **No typed `IntelligenceQuery` model.** | `lib/intel/queries.ts:56-184` is bespoke per-domain `list*` functions with hand-built `WHERE` string arrays returning `Record<string,unknown>[]`. | §13 unified query model absent; every new cross-cut is a new function. |
| **P1-7** | **Whole-tree re-render storm.** | `stores/app-store.tsx:341-382` puts all 8 feeds + vault in one context value. Each `useFeed` `setState` (`:251`) makes a new context value → **every** `useApp()` consumer re-renders. Markets ticks every 30 s, aircraft every 15 s. | The single largest client-perf liability; every panel re-renders on every feed tick. |

### P2 — scale / performance / UX

| ID | Finding | Evidence |
|---|---|---|
| **P2-1** | **Polling never pauses when the tab is hidden.** No `visibilitychange`/`document.hidden` anywhere (`stores/app-store.tsx:240-277`, `:222-236`). Backgrounded tabs keep hitting OpenSky/GDELT/Finnhub/ACLED; render loop keeps running per-frame SGP4. |
| **P2-2** | **Per-frame `Cartesian3` allocation in moving-layer position callbacks.** `lib/globe/render/motion.ts:131` allocates a new `Cartesian3` per entity per frame; ~900 satellites × 60 fps ≈ 54k allocs/s → GC pressure. Fix: scratch vector (pattern already used in `lod.ts:112`). |
| **P2-3** | **No spatial index — viewport/proximity queries are full scans.** `lib/intel/queries.ts:64,166` bbox = `lat/lon BETWEEN`; `resolve.ts:102` `nearestCountry` is an O(n) haversine loop. No R*Tree/geohash/H3. |
| **P2-4** | **Unbounded in-memory cache.** `lib/core/cache.ts:24` `MemoryCache` is a `Map` with no eviction; per-query keys (`gdelt:${q}`, `worldbank:${iso}`) grow without bound → memory-exhaustion vector on `/api/news`. |
| **P2-5** | **Inspector does linear `.find()` over full feed arrays every render.** `Inspector.tsx:32-47` scans up to 900 sats / 500 vessels; re-runs on every context re-render (P1-7), not just selection change. |
| **P2-6** | **Live-fetch path has no retry/backoff and no rate-limiting.** `withRetry`/`RateLimiter` exist in `lib/intel/pool.ts` but are used by *neither* `lib/core/provider.ts` nor `lib/providers/*`. World Bank fires 6 un-pooled fetches per call (`lib/providers/worldbank.ts:69`). |
| **P2-7** | **Command palette re-filters against the whole store on every keystroke and every poll.** `CommandPalette.tsx:94` memo deps `[q, app]`; `app` is new each tick, so it recomputes even while closed. |
| **P2-8** | **Mobile bottom sheets are not accessible modals.** `components/layout/Hud.tsx:19-31` — plain scrolling `div`, no `role="dialog"`/`aria-modal`/focus trap; grab-handle is a decorative `::before` implying a drag that isn't wired. `.app-shell` uses `100vh` not `100dvh` (`globals.css:109`). |
| **P2-9** | **Sub-44px touch targets on primary in-sheet controls.** `.layer-row` (~30px), `.chip` (~22px), `.seg`, `.mini-row`, `.ent-row` (`globals.css:213,261,352,361,534`). |
| **P2-10** | **No focus trap / focus restoration in the command palette modal.** `CommandPalette.tsx:104-149` — Tab escapes into the globe behind; focus not restored on close. |
| **P2-11** | **Selected intelligence not announced to assistive tech.** Globe canvas has no `role`/`aria`/keyboard nav (`Globe.tsx:79,759`); selection is mirrored to the DOM Inspector (good) but no `aria-live` announces it. |

### P3 — polish / maintainability

| ID | Finding | Evidence |
|---|---|---|
| **P3-1** | 4 `set-state-in-effect` lint warnings. `app-store.tsx:302`, `Inspector.tsx:269`, `CommandPalette.tsx:42`, + `exhaustive-deps` `app-store.tsx:275`. |
| **P3-2** | Global header `overallStatus` ignores 5 of 8 feeds — can show LIVE while conflict/maritime is offline (`components/layout/TopBar.tsx:32-37`; `SystemStatus.tsx:53` does it correctly → the two disagree). |
| **P3-3** | Layer/mode `operational`/`status` flags contradict what ships: markets polled live but layer `status:"planned"`; space/maritime live but modes `operational:false` (`lib/config/modes.ts:31`, `layers.ts:40,44`). |
| **P3-4** | Provenance block missing from Inspector for vessel/weather/satellite/country (`Inspector.tsx:187,209,227,260`) — inconsistent surfacing. Confidence not shown for vessel/weather/satellite. No "nearby" context for any type. |
| **P3-5** | News pinned to country centroids renders identically to precise points (`Globe.tsx:808-816`, `resolve.ts:86`). Honest data, but precision is not signalled. Same for dead-reckoned vs observed positions (`motion.ts:142`). |
| **P3-6** | Satellite propagation reads `Date.now()`, not `viewer.clock` (`layers.ts:133`, `orbits.ts:120`). Disclosed in roadmap; blocks the planned replay/scrub controller (§7). |
| **P3-7** | `OrbitTrail` rebuilds 3 polylines/sec via `entities.removeAll()` (`orbits.ts:118-139`) — the last teardown holdout (N=1, acceptable). |
| **P3-8** | Generic `entities` table duplicates domain tables with empty `data:{}` shadow rows and no reconciliation (`repositories.ts:50,178,190`). |
| **P3-9** | `change_log` table defined but has 0 rows and no writer (`migrations.ts:149`) — "transformation history" is claimed but not implemented. `rawPath` never written; only 3 providers set `rawHash`. |
| **P3-10** | Pervasive `as never[]` / `Record<string,unknown>` casts at the DB boundary (`queries.ts:69,82,95…`) erase type safety (not unsafe in practice — columns are explicitly SELECTed). |
| **P3-11** | Doc/reality drift: `docs/globe/GLOBE-AUDIT.md:51` claims "React Compiler is respected" — no compiler is enabled; AlertCenter uses local-tz time in an otherwise UTC UI (`AlertCenter.tsx:56`); weather timestamp blindly appends `Z` (`Inspector.tsx:218`). |

---

## 3. What the briefing worried about that is **already handled** (verified)

Recording these prevents wasted rework:

- **Static-layer diff/patch (commit `80be17e`) is real.** Events/news/weather/conflict use `StaticLayer`; aircraft/vessels/satellites use `MovingLayer`; both diff by stable id. No datasource teardown-per-poll remains (`lib/globe/render/static.ts:87`, `motion.ts:120`). The "W1 teleport" weakness is genuinely closed.
- **Cesium lifecycle is disciplined.** `ScreenSpaceEventHandler` destroyed in cleanup (`Globe.tsx:210,241`); every `postRender` listener is removed in `dispose()`; timers cleared; trail/effect buffers bounded. No handler/timer/entity leak found.
- **Trust discipline in the UI is strong.** No fabricated values rendered as real; `null` → `—`; mock/cached/offline honestly labeled via `StatusBadge`/`DataStatus`; `locateNews`/`resolveCountry` return `null` rather than inventing coordinates (`resolve.ts:86`, tested). Correlations carry explicit `basis` + lower confidence (`enrich.ts:33`); no autonomous SPATIAL_NEAR engine fabricates edges.
- **Migrations are forward-only, transactional, additive** — no destructive `DROP`/`DELETE` (`migrations.ts:186-207`).
- **SSRF surface is closed** — every outbound `fetch` targets a hardcoded host; client input only parameterizes query strings/validated path segments (`iso` regex-gated `^[A-Z]{2,3}$`, `q` length-capped). This is **P3 defense-in-depth, not P0**.
- **Secrets handled correctly** — keys read only server-side via `process.env`; `/api/health` reports `!!process.env[k]`; `fetchJson` logs only `hostOf(url)`. One fragility: MarineTraffic puts the key in the URL path (`marinetraffic.ts:83`) — safe today but add explicit logger redaction.
- **Partial-failure isolation is a genuine strength** — `runProvider` never throws a 500; `runIngestor` isolates each domain; `ingestNews` wraps each source. One broken feed does not break the globe.

---

## 4. Concept coverage (vault as knowledge graph)

| Concept | Modeled? | Where |
|---|---|---|
| Entity (generic node) | partial (thin shadow of domain tables) | `schemas.ts:38` |
| Observation (general) | no (only econ/weather/market value-rows) | `schemas.ts:142,233,248` |
| Event | yes | `schemas.ts:64` |
| Source · Document | yes · partial (NewsArticle only) | `sources.ts:56` · `schemas.ts:84` |
| **Claim / Assertion** | **no** | — |
| Relationship (subj/pred/obj/basis/conf) | yes, **but provenance dropped** | `enrich.ts:12`, `repositories.ts:70` |
| TimeInterval | no (validFrom/To strings on relations only) | `schemas.ts:57` |
| Story-Cluster | yes (Jaccard, explainable) | `stories.ts` |
| Provenance (record-level) | partial (5/15 upserts) | `repositories.ts:18` |
| **Provenance (claim-level)** | **no** | — |
| Entity resolution (aliases/conf/basis) | partial (countries only; person/org = ID dedup) | `resolve.ts`, `ids.ts` |
| Correlation engine (SPATIAL/TEMPORAL_NEAR) | no (bases declared, none generated) | `ontology.ts:47` |
| **Spatial index (R*Tree/geohash/H3)** | **no** (full-scan bbox) | `queries.ts:64` |
| FTS5 | partial (news/events; `fts_entities` unused) | `migrations.ts:159` |
| Typed IntelligenceQuery | no | `queries.ts:56` |

---

## 5. Headline assessment

Atlas is **healthier than the briefing assumes on rendering and trust discipline, and weaker than it assumes on lineage completeness and architectural convergence.** The Cesium engine is well-built and leak-free; the diff/patch milestone is real. The core trust invariant (never show fabricated data as live) holds in the UI and in geolocation. The failures cluster in four places, in priority order:

1. **Freshness is not surfaced on the vault-read API** (P0-1) and **provenance breaks for relationships and most record types** (P0-2, P0-4) — the lineage chain the whole product promises is incomplete.
2. **Two of everything** — two provider frameworks (P1-2), two registries (P1-3) — doubles reasoning cost and lets trust semantics diverge.
3. **The React-Compiler lint errors keep the Definition-of-Done gate red** (P1-1) and the **single-context store causes a re-render storm** (P1-7).
4. **Everything is on the Entity API** (P1-5) with **no spatial index** (P2-3) — the scale ceiling is close.

The prioritized remediation sequence is in `02-prioritized-engineering-plan.md`; measurable baselines are in `01-performance-baseline.md`.
