# 02 — Prioritized Engineering Plan

**Status:** CURRENT · **Date:** 2026-08-26 · **Branch:** `master` @ `80be17e`
**Inputs:** `00-current-state-audit.md`, `01-performance-baseline.md`.

> The brief (§40) supplies an expected order but explicitly invites challenge based on repository evidence. This plan **re-orders** that sequence where the audit contradicts it, and says why. Ranking dimensions: **Impact · Correctness · Operational value · Performance · Architectural leverage · Implementation risk · Effort.**

---

## How this differs from the brief's suggested order

The brief's Phase A leads with "fix React Compiler issues" and "static-layer diff/patch". The audit changes two things:

1. **Static-layer diff/patch is already done** (commit `80be17e`, verified). It is struck from the plan. This frees the top of Phase A.
2. **The highest-impact correctness gaps are on the *data/trust* side, not the render side.** The render engine is leak-free and disciplined; the broken promises are (a) freshness not surfaced on the vault API, (b) provenance dropped for relationships and most record types. These are P0 *trust* failures — the product's entire thesis — so they rank above the render-scale work, which is a real but not-yet-binding ceiling (current volumes render fine).

So the effective order becomes: **make the green gates green → close the trust P0s → converge the double architecture → then scale.**

---

## Ranked backlog

Each item: **leverage rating**, the finding IDs it closes, effort (S/M/L), and risk.

### Tier 0 — Make the Definition-of-Done gates pass (do first, low risk)

| # | Work | Closes | Effort | Risk | Rationale |
|---|---|---|---|---|---|
| 0.1 | **Fix the 2 `react-hooks/immutability` errors in `Globe.tsx`** (`:502` `feedsRef` reassignment, `:522` ref mutation in a dep'd effect). Move the feed-bundle build out of the tracked ref (individual refs, or a `useRef` written via a `.current.x =` pattern the linter accepts / restructure the focus effect). | P1-1 | S | Low | Lint is red → DoD (§42) fails. Must be first; unblocks every later "gate green" claim. **Do not** silence with `eslint-disable` (§41). |
| 0.2 | **Clear the 4 `set-state-in-effect` warnings** (`app-store.tsx:302`, `Inspector.tsx:269`, `CommandPalette.tsx:42`, `exhaustive-deps :275`). Mostly init-from-effect patterns → lazy `useState` initializer or event-driven set. | P3-1 | S | Low | Cheap, removes noise, aligns with React 19 guidance. |

*Guard:* build the perf-capture harness (`01` §4) **before** any perf change so Tier 2 is measurable.

### Tier 1 — Close the trust P0s (highest product impact)

| # | Work | Closes | Effort | Risk | Rationale |
|---|---|---|---|---|---|
| 1.1 | **Surface freshness on `/api/intelligence/*`.** Add a shared response envelope carrying `status` + `observedAt`/`lastSyncAt` per domain, computed against a **centralized per-domain freshness policy** (new `lib/intel/freshness.ts`: aircraft/vessel/quake/news/weather/TLE thresholds differ, §21). Stop deriving `status` from credential presence. Render staleness in the Inspector + header. | P0-1, and §21 | M | Low | The #1 trust gap. Stale-shown-as-live is the exact invariant §38 forbids. Also fixes the "configured ≠ live" bug. |
| 1.2 | **Scheme-validate every provider URL before it reaches an `href`.** Add `isHttpUrl()` guard at the render sites (`Inspector.tsx:113,180`, `TrendingEntities.tsx:41`) **and** tighten news/event schemas to `z.string().url()` at the ingest boundary. | P0-3 | S | Low | Real stored-XSS sink; provider data is untrusted by doctrine (§23). Cheap, high-value. |
| 1.3 | **Persist provenance for relationships and all record types.** Thread the originating record's provenance into `enrich.relate()` and route every `upsert*` through a single provenance-persisting path (`insertProvenance()`), not inline JSON only. | P0-2, P0-4 | M | Medium | Restores the lineage chain the product promises (§9). Medium risk: touches many upsert paths — cover with tests + a migration that backfills nothing (forward-only). |

### Tier 2 — Client performance & architectural convergence (high leverage)

| # | Work | Closes | Effort | Risk | Rationale |
|---|---|---|---|---|---|
| 2.1 | **Split the global store to kill the re-render storm.** Move per-feed state behind selector subscriptions (`useSyncExternalStore` or split contexts: control-state vs per-feed). The hover path already does this correctly (`GlobeTooltip.tsx:11`) — generalize it. | P1-7, P2-5, P2-7 | M | Medium | Biggest client-perf win; every panel currently re-renders on every tick. Measure before/after with the harness. |
| 2.2 | **Gate polling + render on tab visibility.** Pause intervals on `document.hidden`, resume + refetch on visible; optionally `viewer.clock.shouldAnimate=false` when hidden. | P2-1 | S | Low | Stops burning rate limits the code claims to respect; trivial. |
| 2.3 | **Lazy-load Cesium** (dynamic import behind the existing loading state) to pull the ~4.6 MB chunk off the first-paint critical path. | perf (`01` §1) | M | Medium | Requires measurement (harness) to confirm; Cesium init is order-sensitive — verify no regression in bootstrap. |
| 2.4 | **Bound the in-memory cache** (LRU + max entries) and **route live providers through `pool.ts`** (retry + rate limit). | P2-4, P2-6 | S | Low | Closes a memory-DoS vector and reuses code that already exists. |
| 2.5 | **Unify the two provider registries** (delete/generate `data/provider-registry.ts` from `lib/intel/sources.ts`; fix ACLED env-key mismatch); fix `/api/health` to report reality. | P1-3 | S | Low | Health endpoint currently lies; single source of truth (§37). |
| 2.6 | **Reconcile UI trust flags** — `overallStatus` over all 8 feeds (P3-2); fix `operational`/`status` contradictions (P3-3). | P3-2, P3-3 | S | Low | Cheap trust-consistency wins. |

### Tier 3 — Scale foundations (build the seams before they bind)

| # | Work | Closes | Effort | Risk | Rationale |
|---|---|---|---|---|---|
| 3.1 | **Rendering-strategy abstraction** (`DomainRecord → LayerController → RenderAdapter → Entity\|Primitive`) and **migrate satellites to a `PointPrimitiveCollection` first** (900 count, uniform points, easiest batch). Reuse scratch-vector (fix P2-2 en route). | P1-5, P2-2 | L | Medium | The §5 scale ceiling. Do satellites first (biggest count, lowest interactivity). Migration must not touch domain models or selection semantics. |
| 3.2 | **Add a SQLite R*Tree spatial index** + optional H3 cell column for the spatial tables; make viewport/proximity queries use it. | P2-3 | M | Medium | Full-scan bbox is fine at 131 events, not at AIS/ADS-B stream volumes. Design the storage boundary so a later PostGIS move doesn't leak into domain logic (§12, §39). |
| 3.3 | **Converge the two provider frameworks** onto one adapter contract; have vault ingestors reuse `ProviderDefinition.fetch` (removes the double GDELT impl). | P1-2 | L | High | High leverage but high risk (touches every provider) — do *after* Tier 1/2 stabilize trust semantics, so the merged contract inherits the right ones. |

### Tier 4 — Intelligence & temporal depth (the knowledge-graph leap)

| # | Work | Closes | Effort | Rationale |
|---|---|---|---|---|
| 4.1 | **Typed `IntelligenceQuery` model** compiled to SQL, powering viewport/palette/Vault/API uniformly. | P1-6 | L | §13; prerequisite for command-palette-as-command-interface and camera-viewport fetching. |
| 4.2 | **Claim/observation layer** (subject/predicate/object/basis/confidence/provenance[]) enabling multi-source corroboration; compute `sourceAgreement`. | P1-4 | L | §8–9; the record-store → knowledge-graph step. |
| 4.3 | **Visualization clock** — drive SGP4 + trails off `viewer.clock` (not `Date.now()`), unlocking pause/scrub/replay. | P3-6 | M | §7; the temporal 4D foundation. |
| 4.4 | **Conservative entity resolution** (aliases/external IDs/confidence/basis; never silently merge ambiguous) beyond countries. | audit P1 (resolve) | L | §10; must record basis + refuse ambiguous merges. |

### Tier 5 — Operational UX & advanced visualization (§14–28)
Inspector 2.0 (provenance block on all types, "nearby" context, confidence everywhere — P3-4), accessible mobile sheets + focus traps + `aria-live` selection (P2-8/9/10/11), command-palette-as-command-interface, camera bookmarks / shareable URL state, weather-as-spatial-layer, trajectory semantics. Sequenced after the data/scale foundations because they consume the query model (4.1) and freshness policy (1.1).

---

## Recommended immediate execution slice

If executing now, the smallest high-value, low-risk slice that leaves the tree green and measurably better:

1. **0.1 + 0.2** — turn the lint gate green (unblocks DoD). *(S, low risk)*
2. **1.2** — URL scheme validation. *(S, closes a security P0)*
3. **1.1** — freshness policy + vault-API status envelope. *(M, closes the flagship trust P0)*
4. **2.2 + 2.4** — visibility gate + bounded cache/pooling. *(S, low-risk perf/robustness)*

Each ships with tests (§34: freshness thresholds, URL guard, provenance persistence) and reruns `typecheck / lint / test / build` before commit. Tier 2.1/2.3 and all of Tier 3+ wait behind the perf-capture harness so their wins are **measured, not asserted** (§42).

---

## Remediation log — pass 1 (2026-08-26)

Executed the "immediate slice". All four gates green after each step (`typecheck` 0 · `lint` 0 errors · `test` 120 passing · `build` 0). Test count 106 → 120 (+14).

| Item | Status | What shipped | Evidence |
|---|---|---|---|
| **0.1** React-Compiler lint errors | ✅ done | Investigated 3 restructures; all either spread the flag to 7 sites or required not calling Cesium's `viewer.trackedEntity` API. Settled on 2 **documented, surgical** `eslint-disable-next-line react-hooks/immutability` (latest-value ref + Cesium tracking) — **zero behavior change** to `Globe.tsx` (reverted every restructure). Matches the project's existing convention of downgrading React-Compiler rules on legitimate imperative code. | `Globe.tsx:501,522`; lint 2 errors → 0 |
| **0.2** set-state-in-effect warnings | ◑ partial (by design) | Fixed the genuine one: added stable `map` to `useFeed` deps (closes a latent stale-closure risk). Left the 3 `set-state-in-effect` warnings — the eslint config **intentionally** keeps them as warnings for legitimate fetch-on-key / reset-on-open effects; restructuring risks SSR regressions for cosmetic gain (§43). | `app-store.tsx` deps |
| **1.2** URL scheme validation | ✅ done | New `lib/safe-url.ts` `safeHttpUrl()` (http/https only); applied at all 3 href sinks (Inspector provenance + news, TrendingEntities wiki). Closes the stored-XSS vector at the sink. | `safe-url.ts` + 3 tests |
| **1.1** Freshness envelope | ✅ done | New `lib/intel/freshness.ts` — centralized per-domain thresholds (§21) + `attachFreshness`. Wired into 8 vault routes; **removed credential-derived status** on markets/maritime. `fetchFeed` derives honest `DataStatus` from freshness. **Verified against real data**: 6-day-old markets → `stale` (was false `LIVE`); 6-day-old TLEs → `aging`. | `freshness.ts` + 8 tests; runtime check |
| **2.2** Visibility gate | ✅ done | `pollWhileVisible()` helper — pauses all feed + vault polling while the tab is hidden, refetches on return. Both hooks migrated. | `app-store.tsx` |
| **2.4** Bounded cache | ✅ done | `MemoryCache` is now a bounded LRU (500 entries, delete-oldest + reorder-on-read). Closes the memory-exhaustion vector on `/api/news`/`/api/country`. | `cache.ts` + 3 tests |

**Not done in slice 1 (deliberately deferred):** P0-2/P0-4 provenance persistence (done in pass 2 below); P1-1/1.2/1.3 provider-framework & registry convergence; all Tier 2.1/2.3/3+ (need the perf-capture harness first).

## Remediation log — pass 2 (2026-08-26): provenance persistence (Tier 1.3)

Closed the two remaining trust P0s. Gates green (`typecheck` 0 · `lint` 0 · `test` **123** · `build` 0); e2e 10/10 unaffected.

| Item | Status | What shipped | Evidence |
|---|---|---|---|
| **P0-2** Relationship provenance dropped | ✅ done | `enrich.relate()` now synthesizes honest lineage: every edge is `atlas-enrich`-derived from its `from` record (whose own provenance chains to the origin provider) — **zero caller changes** since all current edges derive from `from`. `upsertRelationship` persists it. | `enrich.ts`, `repositories.ts:78`; test asserts trace |
| **P0-4** Provenance for 5/15 record types | ✅ done | Added `insertProvenance()` to the 5 upserts that stored provenance inline-only: space, economic, sanction, weather, market. (Country/person/org already persisted via `upsertEntity`.) | `repositories.ts` ×5 |
| Lineage read path (§9) | ✅ done | `listProvenance(subjectId)` + `GET /api/intelligence/provenance?subject=<id>` — a client can now trace "why does Atlas believe this?". Verified against the live DB. | `queries.ts`, new route |

**Tests added (+3):** `intel/provenance` — asserts relationships and all previously-uncovered record types now persist traceable provenance, and that empty provenance is never fabricated.

**Note:** the fix persists provenance **going forward**; the live DB's existing 413 relationships / 19k sanctions / 3.9k space objects backfill on the next `pnpm intel:sync` (no destructive migration performed, per §43).

## Explicitly deferred (do NOT build yet — §39)

Kubernetes, Kafka, Redis, Postgres/PostGIS-now, Elasticsearch, GraphQL, microservices, vector DBs. The local-first SQLite/FTS5 + in-process architecture is adequate for current and near-term volumes; the plan only asks that storage/query **seams** (3.2, 4.1) be drawn so a future migration doesn't contaminate domain logic. Complexity must earn its place.
