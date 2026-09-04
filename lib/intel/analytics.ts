/**
 * Cross-domain observability analytics (pure — unit-tested, no I/O).
 *
 * Turns the raw per-country / per-entity signals gathered from the vault + live
 * feeds into composite indices, correlations and ranked, persona-framed
 * insights. Everything here is deterministic and side-effect-free so the "data
 * science" is testable; the route layer does the gathering and calls in.
 *
 * Method, kept honest and simple:
 *  - min-max NORMALISE each raw signal across the country set → 0..1, so a
 *    weighted sum isn't dominated by whichever signal happens to have big units;
 *  - weighted composite indices (Risk / Opportunity / Momentum / Stability);
 *  - Pearson correlation for the cross-domain "dependency" statistics.
 */

export type Persona = "all" | "political" | "finance" | "marketing";

export interface CountrySignals {
  iso2: string;
  iso3?: string;
  name: string;
  region?: string;
  conflict: number; // conflict events (all-time in vault window)
  disaster: number; // disaster events
  severeEvents: number; // events with severity warning|critical
  eventsRecent: number; // events in the recent window (momentum)
  news: number; // news articles mentioning the country
  newsRecent: number; // news in the recent window
  gdp: number | null; // economic indicator (may be absent)
  reachPop: number; // population reach (sum of city populations)
  cities: number; // number of mapped cities
  space: number; // space objects registered to the country
}

export interface CountryScore extends CountrySignals {
  risk: number; // 0..100 — compound operational/political risk
  opportunity: number; // 0..100 — market/expansion attractiveness
  momentum: number; // 0..100 — how much activity is accelerating
  stability: number; // 0..100 — inverse of risk
  /** Normalised 0..1 contributors, for the stacked factor bars. */
  factors: { conflict: number; disaster: number; severity: number; attention: number; reach: number; economy: number };
}

/** Min-max normalise to 0..1 (flat 0 if the range is degenerate). */
export function normalize(values: number[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return values.map(() => 0);
  return values.map((v) => (v - min) / span);
}

/** Pearson correlation coefficient of two equal-length series (0 if degenerate). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const dx = Math.sqrt(n * sxx - sx * sx);
  const dy = Math.sqrt(n * syy - sy * sy);
  if (dx === 0 || dy === 0) return 0;
  return Math.max(-1, Math.min(1, cov / (dx * dy)));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 100);

/**
 * Score every country from its signals. Indices are relative to the supplied
 * set (that's what min-max means) — the leaderboard is "who ranks highest given
 * what we can see right now", which is exactly the observability question.
 */
export function scoreCountries(signals: CountrySignals[]): CountryScore[] {
  if (signals.length === 0) return [];
  const col = (f: (s: CountrySignals) => number) => normalize(signals.map(f));
  const nConflict = col((s) => s.conflict);
  const nDisaster = col((s) => s.disaster);
  const nSevere = col((s) => s.severeEvents);
  const nNews = col((s) => s.news);
  const nReach = col((s) => s.reachPop);
  const nGdp = col((s) => s.gdp ?? 0);
  const nRecent = col((s) => s.eventsRecent + s.newsRecent);

  return signals.map((s, i) => {
    // Risk = danger INTENSITY, not event volume. Leans on conflict + severe
    // (warning/critical) events. Raw disaster *count* and news volume are
    // deliberately excluded from risk: they track sensor coverage and media
    // attention (dense over the US/EU), not actual danger — including them put
    // well-instrumented, peaceful countries at the top. A small disaster-count
    // term keeps a genuine multi-hazard crisis visible without dominating.
    const risk = pct(clamp01(0.5 * nConflict[i] + 0.42 * nSevere[i] + 0.08 * nDisaster[i]));
    const stability = 100 - risk;
    // Opportunity: reachable market + economy, discounted by instability.
    const rawOpp = 0.5 * nReach[i] + 0.3 * nGdp[i] + 0.2 * (nNews[i]);
    const opportunity = pct(clamp01(rawOpp) * (0.4 + 0.6 * (stability / 100)));
    // Momentum: how much of the total activity is in the recent window.
    const totalAct = s.conflict + s.disaster + s.news;
    const recentAct = s.eventsRecent + s.newsRecent;
    const momentum = totalAct > 0 ? pct(clamp01(recentAct / Math.max(1, totalAct))) : pct(nRecent[i]);
    return {
      ...s,
      risk,
      opportunity,
      momentum,
      stability,
      factors: {
        conflict: r2(nConflict[i]),
        disaster: r2(nDisaster[i]),
        severity: r2(nSevere[i]),
        attention: r2(nNews[i]),
        reach: r2(nReach[i]),
        economy: r2(nGdp[i]),
      },
    };
  });
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// --- insights ---------------------------------------------------------------

export interface Insight {
  id: string;
  persona: Exclude<Persona, "all">;
  kind: "risk" | "opportunity" | "synergy" | "signal";
  title: string;
  detail: string;
  score: number; // ranking weight, higher = surfaced first
  metrics: { label: string; value: string }[];
}

export interface EntityRef {
  name: string;
  mentions: number;
  degree?: number; // relationship-graph centrality
  country?: string;
}

export interface InsightInputs {
  scores: CountryScore[];
  persons: EntityRef[];
  organizations: EntityRef[];
  cyber: { kev: number; total: number; topVendors: { vendor: string; count: number }[] };
  sanctions: { total: number; topAuthorities: { authority: string; count: number }[] };
  space: { country: string; count: number }[];
  markets: { symbol: string; name: string; changePct: number; assetClass: string }[];
  correlations: { label: string; r: number }[];
}

/** Build the ranked, persona-framed insight feed — the observability narrative. */
export function buildInsights(inp: InsightInputs): Insight[] {
  const out: Insight[] = [];
  const byRisk = [...inp.scores].sort((a, b) => b.risk - a.risk);
  const byOpp = [...inp.scores].sort((a, b) => b.opportunity - a.opportunity);
  const byMomentum = [...inp.scores].filter((s) => s.eventsRecent + s.newsRecent > 0).sort((a, b) => b.momentum - a.momentum);

  // POLITICAL — hotspots, escalation, sanctions pressure, influential people.
  for (const c of byRisk.slice(0, 4).filter((c) => c.risk > 0)) {
    out.push({
      id: `pol-risk-${c.iso2}`,
      persona: "political",
      kind: "risk",
      title: `${c.name}: elevated risk (${c.risk}/100)`,
      detail: `${c.conflict} conflict + ${c.disaster} disaster events, ${c.severeEvents} severe. Stability ${c.stability}/100.`,
      score: 100 + c.risk,
      metrics: [
        { label: "Risk", value: `${c.risk}` },
        { label: "Conflict", value: `${c.conflict}` },
        { label: "Severe", value: `${c.severeEvents}` },
      ],
    });
  }
  for (const c of byMomentum.slice(0, 2)) {
    out.push({
      id: `pol-mom-${c.iso2}`,
      persona: "political",
      kind: "signal",
      title: `${c.name}: activity accelerating`,
      detail: `${c.eventsRecent} events + ${c.newsRecent} stories in the recent window — momentum ${c.momentum}/100.`,
      score: 80 + c.momentum,
      metrics: [{ label: "Momentum", value: `${c.momentum}` }, { label: "Recent", value: `${c.eventsRecent + c.newsRecent}` }],
    });
  }
  if (inp.sanctions.total > 0) {
    out.push({
      id: "pol-sanctions",
      persona: "political",
      kind: "signal",
      title: `${fmt(inp.sanctions.total)} sanctions in force`,
      detail: `Top authorities: ${inp.sanctions.topAuthorities.slice(0, 3).map((a) => `${a.authority} (${fmt(a.count)})`).join(", ")}.`,
      score: 70,
      metrics: inp.sanctions.topAuthorities.slice(0, 3).map((a) => ({ label: a.authority, value: fmt(a.count) })),
    });
  }
  for (const p of inp.persons.slice(0, 3)) {
    out.push({
      id: `pol-person-${slug(p.name)}`,
      persona: "political",
      kind: "signal",
      title: `${p.name} — high influence`,
      detail: `${p.mentions} mentions${p.degree ? `, ${p.degree} network links` : ""} across the intelligence graph.`,
      score: 50 + Math.min(40, p.mentions),
      metrics: [{ label: "Mentions", value: `${p.mentions}` }, ...(p.degree ? [{ label: "Links", value: `${p.degree}` }] : [])],
    });
  }

  // FINANCE — market movers, sanctions exposure, cyber, energy/space powers.
  const movers = [...inp.markets].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4);
  for (const m of movers) {
    out.push({
      id: `fin-mv-${slug(m.symbol)}`,
      persona: "finance",
      kind: m.changePct >= 0 ? "opportunity" : "risk",
      title: `${m.name || m.symbol} ${m.changePct >= 0 ? "▲" : "▼"} ${Math.abs(m.changePct).toFixed(2)}%`,
      detail: `${m.assetClass} moving ${m.changePct >= 0 ? "up" : "down"} — live market signal.`,
      score: 90 + Math.min(30, Math.abs(m.changePct) * 3),
      metrics: [{ label: "Change", value: `${m.changePct.toFixed(2)}%` }, { label: "Class", value: m.assetClass }],
    });
  }
  if (inp.cyber.kev > 0) {
    out.push({
      id: "fin-cyber",
      persona: "finance",
      kind: "risk",
      title: `${fmt(inp.cyber.kev)} actively-exploited CVEs (KEV)`,
      detail: `Of ${fmt(inp.cyber.total)} tracked. Top exposed vendors: ${inp.cyber.topVendors.slice(0, 3).map((v) => v.vendor).join(", ")}.`,
      score: 75,
      metrics: inp.cyber.topVendors.slice(0, 3).map((v) => ({ label: v.vendor, value: `${v.count}` })),
    });
  }
  for (const c of byRisk.slice(0, 3).filter((c) => c.risk > 40)) {
    out.push({
      id: `fin-supply-${c.iso2}`,
      persona: "finance",
      kind: "risk",
      title: `${c.name}: supply-chain exposure`,
      detail: `Operational risk ${c.risk}/100 — factor volatility into sourcing / counterparty exposure here.`,
      score: 55 + c.risk / 2,
      metrics: [{ label: "Risk", value: `${c.risk}` }, { label: "Stability", value: `${c.stability}` }],
    });
  }

  // MARKETING — opportunity markets, reach, trending topics/entities.
  for (const c of byOpp.slice(0, 4).filter((c) => c.opportunity > 0)) {
    out.push({
      id: `mkt-opp-${c.iso2}`,
      persona: "marketing",
      kind: "opportunity",
      title: `${c.name}: expansion market (opportunity ${c.opportunity}/100)`,
      detail: `${fmt(Math.round(c.reachPop))} urban reach across ${fmt(c.cities)} cities, stability ${c.stability}/100.`,
      score: 100 + c.opportunity,
      metrics: [
        { label: "Opportunity", value: `${c.opportunity}` },
        { label: "Reach", value: fmt(Math.round(c.reachPop)) },
        { label: "Stability", value: `${c.stability}` },
      ],
    });
  }
  for (const o of inp.organizations.slice(0, 3)) {
    out.push({
      id: `mkt-org-${slug(o.name)}`,
      persona: "marketing",
      kind: "signal",
      title: `${o.name} — trending organization`,
      detail: `${o.mentions} mentions in the current news graph.`,
      score: 50 + Math.min(40, o.mentions),
      metrics: [{ label: "Mentions", value: `${o.mentions}` }],
    });
  }
  // Synergy: high-opportunity AND low-risk = clean growth markets.
  const clean = inp.scores.filter((c) => c.opportunity >= 40 && c.risk <= 30).sort((a, b) => b.opportunity - a.opportunity).slice(0, 3);
  for (const c of clean) {
    out.push({
      id: `mkt-syn-${c.iso2}`,
      persona: "marketing",
      kind: "synergy",
      title: `${c.name}: high reach, low risk`,
      detail: `Opportunity ${c.opportunity} with risk only ${c.risk} — a clean growth market.`,
      score: 85 + c.opportunity - c.risk,
      metrics: [{ label: "Opp", value: `${c.opportunity}` }, { label: "Risk", value: `${c.risk}` }],
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ===========================================================================
// Mathematical toolkit — the "exploration" math behind the Observatory panels.
// All pure & deterministic (no Math.random) so every equation is unit-tested.
// ===========================================================================

export interface Stats { mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number; n: number; }

/** Descriptive statistics of a sample.  σ = √(Σ(xᵢ−μ)² / n). */
export function describe(values: number[]): Stats {
  const n = values.length;
  if (n === 0) return { mean: 0, median: 0, std: 0, min: 0, max: 0, q1: 0, q3: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const q = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return { mean, median: q(0.5), std: Math.sqrt(variance), min: sorted[0], max: sorted[n - 1], q1: q(0.25), q3: q(0.75), n };
}

/** Standard score of each value: zᵢ = (xᵢ − μ) / σ.  (0 if σ = 0.) */
export function zScores(values: number[]): number[] {
  const { mean, std } = describe(values);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

/** Percentile rank (0..100) of each value within the sample (≤ definition). */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 100);
  return values.map((v) => (values.filter((w) => w <= v).length / n) * 100);
}

/** Gini coefficient (0 = perfectly equal, 1 = maximally concentrated). */
export function gini(values: number[]): number {
  const xs = values.filter((v) => v >= 0);
  const n = xs.length;
  const sum = xs.reduce((a, b) => a + b, 0);
  if (n === 0 || sum === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * sorted[i];
  return Math.max(0, Math.min(1, (2 * cum) / (n * sum) - (n + 1) / n));
}

/** Normalised Herfindahl–Hirschman Index (0 = fragmented, 1 = monopoly).
 *  H = Σ sᵢ² over market shares sᵢ; normalised H* = (H − 1/n)/(1 − 1/n). */
export function hhi(values: number[]): number {
  const xs = values.filter((v) => v > 0);
  const n = xs.length;
  const sum = xs.reduce((a, b) => a + b, 0);
  if (n <= 1 || sum === 0) return n === 1 ? 1 : 0;
  const h = xs.reduce((a, v) => a + (v / sum) ** 2, 0);
  return Math.max(0, Math.min(1, (h - 1 / n) / (1 - 1 / n)));
}

/** Cosine similarity of two equal-length vectors: (a·b)/(‖a‖‖b‖), −1..1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Full pairwise Pearson correlation matrix over named signal vectors. */
export function correlationMatrix(vectors: Record<string, number[]>): { keys: string[]; matrix: number[][] } {
  const keys = Object.keys(vectors);
  const matrix = keys.map((k1) => keys.map((k2) => (k1 === k2 ? 1 : Math.round(pearson(vectors[k1], vectors[k2]) * 100) / 100)));
  return { keys, matrix };
}

/** Indices of points on the Pareto frontier that MAXIMISES both x and y
 *  (no other point dominates them on both axes). */
export function paretoFrontier(points: { x: number; y: number }[]): number[] {
  return points
    .map((_, i) => i)
    .filter((i) => !points.some((q, j) => j !== i && q.x >= points[i].x && q.y >= points[i].y && (q.x > points[i].x || q.y > points[i].y)));
}

/** Deterministic k-means over n-dim points. Centroids seeded evenly across the
 *  set ordered by first dimension, so results are stable & testable. */
export function kMeans(points: number[][], k: number, iters = 20): { assignments: number[]; centroids: number[][] } {
  const n = points.length;
  if (n === 0 || k <= 0) return { assignments: [], centroids: [] };
  const kk = Math.min(k, n);
  const dim = points[0].length;
  const order = points.map((_, i) => i).sort((a, b) => points[a][0] - points[b][0]);
  let centroids = Array.from({ length: kk }, (_, c) => points[order[Math.floor((c * (n - 1)) / Math.max(1, kk - 1))]].slice());
  const assignments = new Array(n).fill(0);
  const dist2 = (a: number[], b: number[]) => a.reduce((s, v, d) => s + (v - b[d]) ** 2, 0);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < kk; c++) { const d = dist2(points[i], centroids[c]); if (d < bd) { bd = d; best = c; } }
      if (assignments[i] !== best) { assignments[i] = best; moved = true; }
    }
    const sums = Array.from({ length: kk }, () => new Array(dim).fill(0));
    const counts = new Array(kk).fill(0);
    for (let i = 0; i < n; i++) { counts[assignments[i]]++; for (let d = 0; d < dim; d++) sums[assignments[i]][d] += points[i][d]; }
    centroids = centroids.map((c, ci) => (counts[ci] ? sums[ci].map((s) => s / counts[ci]) : c));
    if (!moved && it > 0) break;
  }
  return { assignments, centroids };
}

/** Weighted composite of already-normalised (0..1) signals → 0..100. */
export function weightedScore(norms: Record<string, number>, weights: Record<string, number>): number {
  let num = 0, den = 0;
  for (const k of Object.keys(weights)) { num += (norms[k] ?? 0) * weights[k]; den += Math.abs(weights[k]); }
  return den === 0 ? 0 : Math.round(Math.max(0, Math.min(1, num / den)) * 100);
}

/** Fractional ranks (1..n, ties share the average rank) — basis for Spearman. */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank across the tie group
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/** Spearman rank correlation ρ — Pearson computed on the ranks (monotonic, robust to outliers). */
export function spearman(xs: number[], ys: number[]): number {
  return pearson(ranks(xs), ranks(ys));
}

/** Spearman matrix mirroring correlationMatrix()'s shape. */
export function rankCorrelationMatrix(vectors: Record<string, number[]>): { keys: string[]; matrix: number[][] } {
  const keys = Object.keys(vectors);
  const matrix = keys.map((k1) => keys.map((k2) => (k1 === k2 ? 1 : Math.round(spearman(vectors[k1], vectors[k2]) * 100) / 100)));
  return { keys, matrix };
}

/** Ordinary least-squares fit y = slope·x + intercept, with coefficient of determination R². */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

/** Higher moments: skewness, excess kurtosis, and coefficient of variation (σ/μ). */
export function shape(values: number[]): { skew: number; kurt: number; cv: number } {
  const n = values.length;
  if (n < 3) return { skew: 0, kurt: 0, cv: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const m2 = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const s = Math.sqrt(m2);
  if (s === 0) return { skew: 0, kurt: 0, cv: 0 };
  const m3 = values.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  const m4 = values.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  return { skew: m3 / s ** 3, kurt: m4 / s ** 4 - 3, cv: mean === 0 ? 0 : s / mean };
}

/** Shannon entropy of a non-negative distribution, normalised to 0..1 (÷ log₂ n)
 *  so concentration is comparable across signals: 1 = perfectly even, 0 = a single actor. */
export function normalizedEntropy(values: number[]): number {
  const xs = values.filter((v) => v > 0);
  const sum = xs.reduce((a, b) => a + b, 0);
  if (xs.length <= 1 || sum === 0) return 0;
  const h = -xs.reduce((a, v) => { const p = v / sum; return a + p * Math.log2(p); }, 0);
  return h / Math.log2(xs.length);
}
