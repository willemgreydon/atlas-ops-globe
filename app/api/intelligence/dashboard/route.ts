import { NextResponse } from "next/server";
import { getReadDb } from "@/lib/intel/db";
import { finnhubConfigured, fetchQuotes } from "@/lib/intel/providers/finnhub";
import { cachedFetch } from "@/lib/intel/live";
import {
  scoreCountries,
  buildInsights,
  pearson,
  type CountrySignals,
  type CountryScore,
  type EntityRef,
} from "@/lib/intel/analytics";
import reach from "@/lib/intel/data/country-reach.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REACH = reach as Record<string, { pop: number; cities: number }>;
const RECENT_MS = 14 * 86_400_000;
// Conflict is a rolling media signal — count only the last 30 days so stale
// events decay out of the Risk index and a country doesn't stay "hot" forever
// on incidents that have gone quiet. Disasters/quakes keep their own lifecycle.
const CONFLICT_WINDOW_MS = 30 * 86_400_000;

// Warm-instance cache so a dashboard load doesn't hammer the Turso read quota.
let cache: { at: number; body: unknown } | null = null;
const TTL_MS = 5 * 60_000;

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown) => (v == null ? "" : String(v));

/** Sum a per-country_code aggregate under both a country's iso2 and iso3. */
function pick(map: Map<string, number>, iso2: string, iso3?: string): number {
  return (map.get(iso2) ?? 0) + (iso3 ? map.get(iso3) ?? 0 : 0);
}

function build(): unknown {
  const db = getReadDb();
  const all = (sql: string, params: unknown[] = []): Row[] => db.prepare(sql).all(...params) as Row[];
  const recentIso = new Date(Date.now() - RECENT_MS).toISOString();
  const conflictSinceIso = new Date(Date.now() - CONFLICT_WINDOW_MS).toISOString();

  // --- per-country aggregates (GROUP BY, bounded) ---------------------------
  const countries = all("SELECT iso2, iso3, name, region FROM countries");
  const toMap = (rows: Row[], key: string, val: string) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = str(r[key]); if (k) m.set(k, num(r[val])); }
    return m;
  };
  const conflict = toMap(all("SELECT country_code, COUNT(*) c FROM events WHERE kind='conflict' AND country_code IS NOT NULL AND occurred_at >= ? GROUP BY country_code", [conflictSinceIso]), "country_code", "c");
  const disaster = toMap(all("SELECT country_code, COUNT(*) c FROM events WHERE kind='disaster' AND country_code IS NOT NULL GROUP BY country_code"), "country_code", "c");
  const severe = toMap(all("SELECT country_code, COUNT(*) c FROM events WHERE severity IN ('warning','critical') AND country_code IS NOT NULL GROUP BY country_code"), "country_code", "c");
  const eventsRecent = toMap(all("SELECT country_code, COUNT(*) c FROM events WHERE occurred_at >= ? AND country_code IS NOT NULL GROUP BY country_code", [recentIso]), "country_code", "c");
  const news = toMap(all("SELECT country_code, COUNT(*) c FROM news_articles WHERE country_code IS NOT NULL GROUP BY country_code"), "country_code", "c");
  const newsRecent = toMap(all("SELECT country_code, COUNT(*) c FROM news_articles WHERE published_at >= ? AND country_code IS NOT NULL GROUP BY country_code", [recentIso]), "country_code", "c");
  const space = toMap(all("SELECT country, COUNT(*) c FROM space_objects WHERE country IS NOT NULL GROUP BY country"), "country", "c");

  // Economy: prefer a GDP-like indicator per country, else its largest value.
  const gdp = new Map<string, number>();
  for (const r of all("SELECT country_code, indicator, value FROM economic_observations")) {
    const k = str(r.country_code); if (!k) continue;
    const isGdp = /gdp/i.test(str(r.indicator));
    const v = num(r.value);
    if (isGdp) gdp.set(k, v);
    else if (!gdp.has(k)) gdp.set(k, Math.max(gdp.get(k) ?? 0, v));
  }

  // --- build per-country signals + scores -----------------------------------
  const signals: CountrySignals[] = countries.map((c) => {
    const iso2 = str(c.iso2), iso3 = str(c.iso3);
    const rr = REACH[iso2] ?? REACH[iso3] ?? { pop: 0, cities: 0 };
    return {
      iso2, iso3, name: str(c.name), region: str(c.region) || undefined,
      conflict: pick(conflict, iso2, iso3),
      disaster: pick(disaster, iso2, iso3),
      severeEvents: pick(severe, iso2, iso3),
      eventsRecent: pick(eventsRecent, iso2, iso3),
      news: pick(news, iso2, iso3),
      newsRecent: pick(newsRecent, iso2, iso3),
      gdp: gdp.has(iso2) ? gdp.get(iso2)! : gdp.has(iso3) ? gdp.get(iso3)! : null,
      reachPop: rr.pop,
      cities: rr.cities,
      space: pick(space, iso2, iso3),
    };
  });
  const scores: CountryScore[] = scoreCountries(signals);

  // --- entities: influence (mentions) + relationship-graph centrality -------
  const persons = all("SELECT canonical_name n, mention_count m FROM persons ORDER BY mention_count DESC LIMIT 12");
  const orgs = all("SELECT canonical_name n, mention_count m, country_code cc FROM organizations ORDER BY mention_count DESC LIMIT 12");
  const rels = all("SELECT from_id a, to_id b, type t FROM relationships");
  const degree = new Map<string, number>();
  for (const r of rels) {
    for (const id of [str(r.a), str(r.b)]) if (id) degree.set(id, (degree.get(id) ?? 0) + 1);
  }
  const ent = new Map<string, { name: string; kind: string; country?: string }>();
  for (const r of all("SELECT id, name, type, country_code cc FROM entities")) {
    const id = str(r.id);
    ent.set(id, { name: str(r.name) || id.replace(/^.*[:/]/, ""), kind: str(r.type) || id.split(":")[0] || "entity", country: str(r.cc) || undefined });
  }
  const nameOf = (id: string) => ent.get(id)?.name || id.replace(/^.*[:/]/, "");
  const connected = [...degree.entries()]
    .map(([id, d]) => ({ name: nameOf(id), degree: d, mentions: 0 } as EntityRef))
    .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
    .slice(0, 10);

  // Real relationship subgraph: the most-connected N entities and the ACTUAL
  // edges between them (deduped, undirected) — no synthesised topology.
  const GRAPH_NODES = 32;
  const topIds = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, GRAPH_NODES).map(([id]) => id);
  const gIndex = new Map(topIds.map((id, i) => [id, i]));
  const graphNodes = topIds.map((id) => {
    const meta = ent.get(id);
    return { id, name: nameOf(id), kind: meta?.kind || id.split(":")[0] || "entity", degree: degree.get(id) ?? 0, country: meta?.country };
  });
  const seenEdge = new Set<string>();
  const graphEdges: { a: number; b: number; type: string }[] = [];
  for (const r of rels) {
    const a = gIndex.get(str(r.a)), b = gIndex.get(str(r.b));
    if (a == null || b == null || a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    graphEdges.push({ a, b, type: str(r.t) });
  }
  const personRefs: EntityRef[] = persons.map((p) => ({ name: str(p.n), mentions: num(p.m) }));
  const orgRefs: EntityRef[] = orgs.map((o) => ({ name: str(o.n), mentions: num(o.m), country: str(o.cc) || undefined }));

  // --- cyber, sanctions, space powers ---------------------------------------
  const cyberTotal = num(all("SELECT COUNT(*) c FROM vulnerabilities")[0]?.c);
  const cyberKev = num(all("SELECT COUNT(*) c FROM vulnerabilities WHERE kev=1")[0]?.c);
  const topVendors = all("SELECT vendor, COUNT(*) c FROM vulnerabilities WHERE kev=1 AND vendor IS NOT NULL GROUP BY vendor ORDER BY c DESC LIMIT 6")
    .map((r) => ({ vendor: str(r.vendor), count: num(r.c) }));
  const sanctionsTotal = num(all("SELECT COUNT(*) c FROM sanctions")[0]?.c);
  const topAuthorities = all("SELECT authority, COUNT(*) c FROM sanctions WHERE authority IS NOT NULL GROUP BY authority ORDER BY c DESC LIMIT 6")
    .map((r) => ({ authority: str(r.authority), count: num(r.c) }));
  const spacePowers = all("SELECT country, COUNT(*) c FROM space_objects WHERE country IS NOT NULL GROUP BY country ORDER BY c DESC LIMIT 8")
    .map((r) => ({ country: str(r.country), count: num(r.c) }));

  // --- cross-domain dependency correlations (real Pearson r) ----------------
  const correlations = [
    { label: "News attention ↔ event activity", r: round2(pearson(scores.map((s) => s.news), scores.map((s) => s.conflict + s.disaster))) },
    { label: "Conflict ↔ disaster exposure", r: round2(pearson(scores.map((s) => s.conflict), scores.map((s) => s.disaster))) },
    { label: "Market reach ↔ risk", r: round2(pearson(scores.map((s) => s.reachPop), scores.map((s) => s.risk))) },
    { label: "Space capability ↔ economy", r: round2(pearson(scores.map((s) => s.space), scores.map((s) => s.gdp ?? 0))) },
  ];

  const conflictCountries = scores.filter((s) => s.conflict > 0).length;
  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      conflictCountries,
      // When no conflict data is present, the Risk index reflects natural-hazard
      // severity only — the UI says so, so a Political watcher isn't misled.
      hazardOnly: conflictCountries === 0,
      countriesWithEvents: scores.filter((s) => s.conflict + s.disaster + s.severeEvents > 0).length,
    },
    counts: {
      countries: countries.length, sanctions: sanctionsTotal, vulnerabilities: cyberTotal, kev: cyberKev,
      persons: personRefs.length, organizations: orgRefs.length, relationships: degree.size,
    },
    scores: scores
      .map((s) => ({
        iso2: s.iso2, name: s.name, region: s.region,
        risk: s.risk, opportunity: s.opportunity, momentum: s.momentum, stability: s.stability,
        conflict: s.conflict, disaster: s.disaster, severeEvents: s.severeEvents,
        news: s.news, reachPop: s.reachPop, cities: s.cities, space: s.space,
        factors: s.factors,
      })),
    entities: { persons: personRefs, organizations: orgRefs, connected },
    graph: { nodes: graphNodes, edges: graphEdges },
    cyber: { total: cyberTotal, kev: cyberKev, topVendors },
    sanctions: { total: sanctionsTotal, topAuthorities },
    spacePowers,
    correlations,
    _scoresForInsights: scores, // internal, stripped before send
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  // Live markets (keyless-safe) — never throws out here.
  let markets: { symbol: string; name: string; changePct: number; assetClass: string }[] = [];
  if (finnhubConfigured()) {
    try {
      const quotes = await cachedFetch("markets", 20_000, () => fetchQuotes());
      markets = quotes.map((q) => ({ symbol: q.symbol, name: q.name ?? q.symbol, changePct: q.changePct ?? 0, assetClass: q.assetClass }));
    } catch { /* markets optional */ }
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ ...(cache.body as Record<string, unknown>), markets });
  }

  try {
    const b = build() as Record<string, unknown>;
    const scores = b._scoresForInsights as CountryScore[];
    delete b._scoresForInsights;
    const entities = b.entities as { persons: EntityRef[]; organizations: EntityRef[] };
    const insights = buildInsights({
      scores,
      persons: entities.persons,
      organizations: entities.organizations,
      cyber: b.cyber as { kev: number; total: number; topVendors: { vendor: string; count: number }[] },
      sanctions: b.sanctions as { total: number; topAuthorities: { authority: string; count: number }[] },
      space: b.spacePowers as { country: string; count: number }[],
      markets,
      correlations: b.correlations as { label: string; r: number }[],
    });
    const body = { ...b, insights, status: "live", source: "vault+analytics" };
    cache = { at: Date.now(), body }; // cache the vault-derived part; markets re-merge fresh
    return NextResponse.json({ ...body, markets });
  } catch (e) {
    // Vault unavailable (Turso quota / cold replica): degrade to a 200, never 500.
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      degraded: true,
      status: "offline",
      source: "vault-unavailable",
      coverage: { conflictCountries: 0, hazardOnly: true, countriesWithEvents: 0 },
      counts: {},
      scores: [],
      entities: { persons: [], organizations: [], connected: [] },
      cyber: { total: 0, kev: 0, topVendors: [] },
      sanctions: { total: 0, topAuthorities: [] },
      spacePowers: [],
      correlations: [],
      insights: [],
      markets,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
