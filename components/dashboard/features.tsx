"use client";
import { useMemo, useState } from "react";
import type { DashPayload, DashScore } from "@/stores/app-store";
import {
  describe, zScores, percentileRanks, gini, hhi, cosineSimilarity, correlationMatrix,
  paretoFrontier, kMeans, weightedScore,
} from "@/lib/intel/analytics";
import { Scatter, Radar, Heatmap, Histogram, Bars, Network, type Pt, type NetEdge } from "./charts";

const CLUSTER_COLORS = ["#65f6c7", "#54c7ff", "#ffae45", "#ff5a62", "#b18cff"];
const CMP_COLORS = ["#65f6c7", "#ff9db1", "#54c7ff", "#ffae45"];
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtBig = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${Math.round(n)}`);

/** Raw per-country vectors used across the statistical panels. */
const SIGNALS: { k: keyof DashScore; l: string }[] = [
  { k: "risk", l: "Risk" }, { k: "opportunity", l: "Opportunity" }, { k: "momentum", l: "Momentum" },
  { k: "conflict", l: "Conflict" }, { k: "disaster", l: "Disaster" }, { k: "severeEvents", l: "Severe" },
  { k: "news", l: "News" }, { k: "reachPop", l: "Reach" }, { k: "space", l: "Space" },
];
const FACTOR_AXES = ["conflict", "disaster", "severity", "attention", "reach", "economy"] as const;
const vec = (s: DashScore[], k: keyof DashScore) => s.map((x) => Number(x[k]) || 0);
const factorVec = (s: DashScore) => FACTOR_AXES.map((a) => s.factors[a] ?? 0);

function Panel({ title, sub, wide, children }: { title: string; sub?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`obs-panel ${wide ? "wide" : ""}`}>
      <h3>{title}{sub && <em> · {sub}</em>}</h3>
      {children}
    </div>
  );
}

/* 1–3. Risk–Opportunity portfolio matrix: quadrants + Pareto frontier + clusters. */
export function QuadrantScatter({ data }: { data: DashPayload }) {
  const [mode, setMode] = useState<"frontier" | "clusters">("frontier");
  const scored = useMemo(() => data.scores.filter((s) => s.risk > 0 || s.opportunity > 0), [data]);
  const cluster = useMemo(() => kMeans(scored.map(factorVec), 4), [scored]);
  const front = useMemo(() => new Set(paretoFrontier(scored.map((s) => ({ x: s.opportunity, y: s.stability })))), [scored]);
  const points: Pt[] = scored.map((s, i) => ({
    x: s.risk, y: s.opportunity, label: s.name,
    group: cluster.assignments[i], frontier: mode === "frontier" && front.has(i),
  }));
  return (
    <Panel title="Risk – Opportunity matrix" sub={`${scored.length} countries`}>
      <div className="seg small mb">
        <button className={mode === "frontier" ? "active" : ""} onClick={() => setMode("frontier")}>pareto frontier</button>
        <button className={mode === "clusters" ? "active" : ""} onClick={() => setMode("clusters")}>k-means clusters</button>
      </div>
      <Scatter points={points} xLabel="Risk" yLabel="Opportunity"
        colors={mode === "clusters" ? CLUSTER_COLORS : undefined} showFrontier={mode === "frontier"} />
      <p className="obs-note">Lower-left is calm; upper-left (low risk · high opportunity) is the growth quadrant.
        {mode === "frontier" ? " Line = Pareto-efficient opportunity/stability frontier." : " Colours = archetype clusters (k-means on 6 signal dimensions)."}</p>
    </Panel>
  );
}

/* 9. Interactive weighted-index builder → live re-ranking. */
export function WeightBuilder({ data }: { data: DashPayload }) {
  const [w, setW] = useState<Record<string, number>>({ conflict: 50, severity: 40, disaster: 10, attention: 20, reach: 0, economy: 0 });
  const ranked = useMemo(() => {
    return data.scores
      .map((s) => ({ name: s.name, score: weightedScore(s.factors as unknown as Record<string, number>, w) }))
      .sort((a, b) => b.score - a.score).slice(0, 12);
  }, [data, w]);
  return (
    <Panel title="Custom index builder" sub="weight the signals yourself">
      <div className="weights">
        {FACTOR_AXES.map((a) => (
          <label key={a} className="wrow">
            <span>{a}</span>
            <input type="range" min={0} max={100} value={w[a]} onChange={(e) => setW({ ...w, [a]: +e.target.value })} />
            <b>{w[a]}</b>
          </label>
        ))}
      </div>
      <Bars items={ranked.map((r) => ({ label: r.name, value: r.score }))} max={100} tone="accent" />
    </Panel>
  );
}

/* 10. Full cross-signal correlation heatmap. */
export function CorrelationHeatmap({ data }: { data: DashPayload }) {
  const { keys, matrix, labels } = useMemo(() => {
    const vectors: Record<string, number[]> = {};
    const labels: Record<string, string> = {};
    for (const s of SIGNALS) { vectors[s.k as string] = vec(data.scores, s.k); labels[s.k as string] = s.l; }
    return { ...correlationMatrix(vectors), labels };
  }, [data]);
  return (
    <Panel title="Dependency matrix" sub="pairwise Pearson r">
      <Heatmap keys={keys} matrix={matrix} labels={labels} />
      <p className="obs-note">Green = positive co-movement, red = inverse. |r| ≥ 0.5 is a strong dependency.</p>
    </Panel>
  );
}

/* 11–12. Distribution histogram + descriptive statistics per metric. */
export function DistributionPanel({ data }: { data: DashPayload }) {
  const [metric, setMetric] = useState<keyof DashScore>("risk");
  const values = useMemo(() => vec(data.scores, metric).filter((v) => v > 0 || metric === "risk" || metric === "opportunity"), [data, metric]);
  const st = useMemo(() => describe(values), [values]);
  return (
    <Panel title="Distribution & statistics">
      <div className="seg small mb wrap">
        {SIGNALS.map((s) => <button key={s.k as string} className={metric === s.k ? "active" : ""} onClick={() => setMetric(s.k)}>{s.l}</button>)}
      </div>
      <Histogram values={values} mean={st.mean} median={st.median} />
      <div className="stat-row">
        <span>n <b>{st.n}</b></span><span>μ <b>{st.mean.toFixed(1)}</b></span><span>median <b>{st.median.toFixed(1)}</b></span>
        <span>σ <b>{st.std.toFixed(1)}</b></span><span>Q1 <b>{st.q1.toFixed(1)}</b></span><span>Q3 <b>{st.q3.toFixed(1)}</b></span>
        <span>max <b>{st.max.toFixed(0)}</b></span>
      </div>
      <p className="obs-note"><span className="k-mean">▎</span> mean μ &nbsp; <span className="k-median">▎</span> median</p>
    </Panel>
  );
}

/* 13. Statistical outliers (|z| ≥ 2) across metrics. */
export function OutlierBoard({ data }: { data: DashPayload }) {
  const outliers = useMemo(() => {
    const out: { name: string; metric: string; z: number }[] = [];
    for (const s of SIGNALS) {
      const z = zScores(vec(data.scores, s.k));
      z.forEach((zi, i) => { if (Math.abs(zi) >= 2) out.push({ name: data.scores[i].name, metric: s.l, z: zi }); });
    }
    return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 12);
  }, [data]);
  return (
    <Panel title="Statistical outliers" sub="|z| ≥ 2σ">
      {outliers.length === 0 && <div className="obs-empty small">no outliers</div>}
      <ul className="rank">
        {outliers.map((o, i) => (
          <li key={i}><span>{o.name}</span><em>{o.metric}</em><b className={o.z > 0 ? "up" : "down"}>{o.z > 0 ? "+" : ""}{o.z.toFixed(1)}σ</b></li>
        ))}
      </ul>
    </Panel>
  );
}

/* 15. Risk-adjusted opportunity (Sharpe-like): opportunity / (1 + risk/50). */
export function RiskAdjusted({ data }: { data: DashPayload }) {
  const ranked = useMemo(() => data.scores
    .map((s) => ({ name: s.name, value: +(s.opportunity / (1 + s.risk / 50)).toFixed(1), o: s.opportunity, r: s.risk }))
    .filter((x) => x.o > 0).sort((a, b) => b.value - a.value).slice(0, 10), [data]);
  return (
    <Panel title="Risk-adjusted opportunity" sub="opp ÷ (1 + risk/50)">
      <Bars items={ranked.map((r) => ({ label: r.name, value: r.value, hint: `opp ${r.o} · risk ${r.r}` }))} tone="accent" />
    </Panel>
  );
}

/* 16. Expected impact: risk weighted by population reach. */
export function ExpectedImpact({ data }: { data: DashPayload }) {
  const ranked = useMemo(() => data.scores
    .map((s) => ({ name: s.name, value: Math.round((s.risk / 100) * (s.reachPop / 1e6)), r: s.risk }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 10), [data]);
  return (
    <Panel title="Expected impact" sub="risk × population reach">
      <Bars items={ranked.map((r) => ({ label: r.name, value: r.value, hint: `risk ${r.r}` }))} unit="M" tone="risk" />
      <p className="obs-note">High-risk × high-population — where disruption reaches the most people.</p>
    </Panel>
  );
}

/* 17. Compound risk: countries elevated on multiple risk factors at once. */
export function CompoundRisk({ data }: { data: DashPayload }) {
  const rows = useMemo(() => data.scores
    .map((s) => {
      const flags = [s.factors.conflict > 0.25, s.factors.severity > 0.25, s.factors.disaster > 0.25, s.factors.attention > 0.4];
      return { name: s.name, count: flags.filter(Boolean).length, s };
    })
    .filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || b.s.risk - a.s.risk).slice(0, 10), [data]);
  return (
    <Panel title="Compound-risk detector" sub="≥ 2 elevated factors">
      {rows.length === 0 && <div className="obs-empty small">no compound-risk countries</div>}
      <ul className="rank">
        {rows.map((r) => (
          <li key={r.name}><span>{r.name}</span><em>{["conflict", "severity", "disaster", "attention"].filter((_, i) => [r.s.factors.conflict > 0.25, r.s.factors.severity > 0.25, r.s.factors.disaster > 0.25, r.s.factors.attention > 0.4][i]).join(" · ")}</em><b>{r.count}×</b></li>
        ))}
      </ul>
    </Panel>
  );
}

/* 18. Regional roll-up: reach-weighted mean risk & opportunity by region. */
export function RegionalRollup({ data }: { data: DashPayload }) {
  const regions = useMemo(() => {
    const m = new Map<string, { risk: number; opp: number; w: number; n: number }>();
    for (const s of data.scores) {
      const r = s.region || "—";
      const e = m.get(r) ?? { risk: 0, opp: 0, w: 0, n: 0 };
      const w = 1 + s.reachPop / 1e7;
      e.risk += s.risk * w; e.opp += s.opportunity * w; e.w += w; e.n++;
      m.set(r, e);
    }
    return [...m.entries()].filter(([r]) => r !== "—").map(([r, e]) => ({ region: r, risk: Math.round(e.risk / e.w), opp: Math.round(e.opp / e.w), n: e.n }))
      .sort((a, b) => b.opp - a.opp);
  }, [data]);
  return (
    <Panel title="Regional roll-up" sub="reach-weighted means">
      <table className="mini-table">
        <thead><tr><th>Region</th><th>Risk</th><th>Opp</th><th>#</th></tr></thead>
        <tbody>{regions.map((r) => <tr key={r.region}><td>{r.region}</td><td>{r.risk}</td><td>{r.opp}</td><td>{r.n}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

/* 19 & 21. Compare 2–4 countries: overlaid radars + full signal table, best-in-row highlighted. */
export function CompareCountries({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.risk + b.opportunity - a.risk - a.opportunity), [data]);
  const [picks, setPicks] = useState<string[]>(() => named.slice(0, 2).map((s) => s.iso2));
  const chosen = picks.map((iso) => data.scores.find((s) => s.iso2 === iso)).filter(Boolean) as DashScore[];
  const setAt = (i: number, iso: string) => setPicks((p) => p.map((x, k) => (k === i ? iso : x)));
  const add = () => setPicks((p) => (p.length >= 4 ? p : [...p, (named.find((s) => !p.includes(s.iso2)) ?? named[0])?.iso2].filter(Boolean) as string[]));
  const remove = (i: number) => setPicks((p) => (p.length > 2 ? p.filter((_, k) => k !== i) : p));
  if (chosen.length < 2) return null;
  const headline = ["risk", "opportunity", "momentum", "stability"] as const;
  const rowMax = (get: (c: DashScore) => number) => Math.max(...chosen.map(get));
  return (
    <Panel title="Country comparison" sub={`${chosen.length}-way`} wide>
      <div className="cmp-pick wrap">
        {picks.map((iso, i) => (
          <span key={i} className="cmp-slot" style={{ borderColor: CMP_COLORS[i] }}>
            <select value={iso} onChange={(e) => setAt(i, e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
            {picks.length > 2 && <button className="cmp-x" onClick={() => remove(i)} aria-label="remove country">×</button>}
          </span>
        ))}
        {picks.length < 4 && <button className="cmp-add" onClick={add}>+ add</button>}
      </div>
      <div className="cmp-body">
        <Radar axes={FACTOR_AXES as unknown as string[]}
          series={chosen.map((c, i) => ({ name: c.name, values: factorVec(c).map((v) => v * 100), color: CMP_COLORS[i] }))} />
        <table className="mini-table">
          <thead><tr><th></th>{chosen.map((c, i) => <th key={c.iso2} style={{ color: CMP_COLORS[i] }}>{c.name}</th>)}</tr></thead>
          <tbody>
            {headline.map((k) => {
              const mx = rowMax((c) => c[k]);
              return <tr key={k}><td>{k}</td>{chosen.map((c) => <td key={c.iso2} className={c[k] === mx ? "cell-best" : ""}>{c[k]}</td>)}</tr>;
            })}
            <tr className="tbl-sep"><td colSpan={chosen.length + 1}>factors ×100</td></tr>
            {FACTOR_AXES.map((ax) => {
              const mx = rowMax((c) => c.factors[ax] ?? 0);
              return <tr key={ax}><td>{ax}</td>{chosen.map((c) => { const v = Math.round((c.factors[ax] ?? 0) * 100); return <td key={c.iso2} className={(c.factors[ax] ?? 0) === mx ? "cell-best" : ""}>{v}</td>; })}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* Percentile profile: where one country ranks (0–100) on every signal. */
export function PercentileProfile({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.risk + b.opportunity - a.risk - a.opportunity), [data]);
  const [iso, setIso] = useState(named[0]?.iso2 ?? "");
  const rows = useMemo(() => {
    const idx = data.scores.findIndex((s) => s.iso2 === iso);
    if (idx < 0) return [];
    return SIGNALS.map((s) => ({ label: s.l, value: Math.round(percentileRanks(vec(data.scores, s.k))[idx] ?? 0) }));
  }, [data, iso]);
  return (
    <Panel title="Percentile profile" sub="rank vs all countries">
      <select className="full" value={iso} onChange={(e) => setIso(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
      <Bars items={rows.map((r) => ({ label: r.label, value: r.value, hint: `${r.value}th percentile` }))} max={100} tone="accent" />
      <p className="obs-note">100 = highest in the observable set for that signal. High risk with low opportunity is the danger split.</p>
    </Panel>
  );
}

/* Peer benchmark: a country's factors vs its regional mean and the world mean. */
export function PeerBenchmark({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.reachPop - a.reachPop), [data]);
  const [iso, setIso] = useState(named[0]?.iso2 ?? "");
  const target = data.scores.find((s) => s.iso2 === iso);
  const rows = useMemo(() => {
    if (!target) return [];
    const peers = data.scores.filter((s) => s.region && s.region === target.region);
    const mean = (arr: DashScore[], a: typeof FACTOR_AXES[number]) => (arr.length ? arr.reduce((t, s) => t + (s.factors[a] ?? 0), 0) / arr.length : 0);
    return FACTOR_AXES.map((a) => ({
      axis: a,
      you: Math.round((target.factors[a] ?? 0) * 100),
      region: Math.round(mean(peers, a) * 100),
      world: Math.round(mean(data.scores, a) * 100),
    }));
  }, [data, target]);
  if (!target) return null;
  return (
    <Panel title="Peer benchmark" sub={target.region || "—"}>
      <select className="full" value={iso} onChange={(e) => setIso(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
      <table className="mini-table">
        <thead><tr><th>Factor</th><th>{target.name.length > 12 ? target.name.slice(0, 11) + "…" : target.name}</th><th>Region</th><th>World</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.axis}><td>{r.axis}</td><td className={r.you >= r.region ? "up" : "down"}>{r.you}</td><td>{r.region}</td><td>{r.world}</td></tr>
        ))}</tbody>
      </table>
      <p className="obs-note">Factor scores ×100, min-max normalised across the set. Colour = above/below the regional mean.</p>
    </Panel>
  );
}

/* 20. Cosine similarity: nearest peers AND the most different profiles. */
export function SimilarCountries({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.reachPop - a.reachPop), [data]);
  const [iso, setIso] = useState(named[0]?.iso2 ?? "");
  const target = data.scores.find((s) => s.iso2 === iso);
  const { near, far } = useMemo(() => {
    if (!target) return { near: [], far: [] };
    const tv = factorVec(target);
    const ranked = data.scores.filter((s) => s.iso2 !== iso)
      .map((s) => ({ name: s.name, region: s.region, sim: cosineSimilarity(tv, factorVec(s)) }))
      .sort((a, b) => b.sim - a.sim);
    return { near: ranked.slice(0, 6), far: ranked.slice(-4).reverse() };
  }, [data, iso, target]);
  return (
    <Panel title="Profile neighbours" sub="cosine similarity">
      <select className="full" value={iso} onChange={(e) => setIso(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
      <h4>Most similar</h4>
      <ul className="rank">{near.map((s) => <li key={s.name}><span>{s.name}</span><em>{s.region}</em><b>{s.sim.toFixed(2)}</b></li>)}</ul>
      <h4>Most different</h4>
      <ul className="rank">{far.map((s) => <li key={s.name}><span>{s.name}</span><em>{s.region}</em><b className="down">{s.sim.toFixed(2)}</b></li>)}</ul>
    </Panel>
  );
}

/* 22. Entity relationship network — the REAL vault subgraph (no synthesised edges). */
export function EntityNetwork({ data }: { data: DashPayload }) {
  const g = data.graph;
  const label = (n: string) => (n.length > 16 ? n.slice(0, 15) + "…" : n);
  if (!g || g.nodes.length === 0) {
    return (
      <Panel title="Entity relationship network" sub="degree centrality" wide>
        <div className="obs-empty small">No entity graph yet — persons &amp; organisations and their links are extracted from the news feed as it ingests into the vault.</div>
      </Panel>
    );
  }
  const nodes = g.nodes.map((n) => ({ id: n.id, label: label(n.name), weight: n.degree, kind: n.kind }));
  const edges: NetEdge[] = g.edges.map((e) => ({ a: e.a, b: e.b }));
  return (
    <Panel title="Entity relationship network" sub={`${g.nodes.length} nodes · ${g.edges.length} links`} wide>
      <Network nodes={nodes} edges={edges} legend />
      <p className="obs-note">The real relationship graph from the vault. Node size = degree centrality; colour = entity type. Hover an entity to trace only its links.</p>
    </Panel>
  );
}

/* Signal-dependency graph: signals as nodes, strong correlations as signed edges.
 * Built from the always-present per-country score vectors, so it's never empty. */
export function SignalDependencyGraph({ data }: { data: DashPayload }) {
  const { nodes, edges, links } = useMemo(() => {
    const vectors: Record<string, number[]> = {};
    for (const s of SIGNALS) vectors[s.k as string] = vec(data.scores, s.k);
    const { keys, matrix } = correlationMatrix(vectors);
    const labelOf = Object.fromEntries(SIGNALS.map((s) => [s.k as string, s.l]));
    const strength = keys.map((_, i) => matrix[i].reduce((t, r, j) => (i === j ? t : t + Math.abs(r)), 0));
    const nodes = keys.map((k, i) => ({ id: k, label: labelOf[k] || k, weight: strength[i], kind: "signal" }));
    const edges: NetEdge[] = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const r = matrix[i][j];
      if (Math.abs(r) >= 0.35) edges.push({ a: i, b: j, w: Math.abs(r), tone: r >= 0 ? "pos" : "neg" });
    }
    return { nodes, edges, links: edges.length };
  }, [data]);
  if (data.scores.length < 3) {
    return <Panel title="Signal dependency graph" sub="|r| ≥ 0.35" wide><div className="obs-empty small">not enough countries to correlate signals</div></Panel>;
  }
  return (
    <Panel title="Signal dependency graph" sub={`|r| ≥ 0.35 · ${links} links`} wide>
      <Network nodes={nodes} edges={edges} />
      <p className="obs-note">Nodes are the signal dimensions; a link means the two move together (<span className="k-pos">green</span>) or inversely (<span className="k-neg">red</span>) across all countries. Thicker = stronger; node size = total coupling.</p>
    </Panel>
  );
}

/* Influence leaderboard: connectivity (graph degree) beside attention (mentions). */
export function EntityLeaderboard({ data }: { data: DashPayload }) {
  const byDegree = (data.graph?.nodes ?? []).filter((n) => n.degree > 0).slice(0, 10);
  const byMentions = useMemo(() => [
    ...data.entities.persons.map((p) => ({ name: p.name, mentions: p.mentions, kind: "person" })),
    ...data.entities.organizations.map((o) => ({ name: o.name, mentions: o.mentions, kind: "org" })),
  ].sort((a, b) => b.mentions - a.mentions).slice(0, 10), [data]);
  if (byDegree.length === 0 && byMentions.length === 0) {
    return <Panel title="Influence leaderboard"><div className="obs-empty small">no tracked entities yet</div></Panel>;
  }
  return (
    <Panel title="Influence leaderboard" sub="connectivity · attention">
      <div className="infl-cols">
        <div>
          <h4>By connectivity</h4>
          <ul className="rank">{byDegree.map((n) => <li key={n.id}><span>{n.name}</span><em>{n.kind}</em><b>{n.degree}</b></li>)}</ul>
          {byDegree.length === 0 && <div className="obs-empty small">no graph links</div>}
        </div>
        <div>
          <h4>By attention</h4>
          <ul className="rank">{byMentions.map((e) => <li key={e.kind + e.name}><span>{e.name}</span><em>{e.kind}</em><b>{e.mentions}</b></li>)}</ul>
          {byMentions.length === 0 && <div className="obs-empty small">no mentions</div>}
        </div>
      </div>
    </Panel>
  );
}

/* Where the organisation graph concentrates — org count by home country. */
export function OrgCountryFlows({ data }: { data: DashPayload }) {
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data.entities.organizations) { const k = o.country || "—"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].filter(([k]) => k !== "—").map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [data]);
  return (
    <Panel title="Organisation footprint" sub="tracked orgs by country">
      {rows.length === 0 && <div className="obs-empty small">no org-country data yet</div>}
      {rows.length > 0 && <Bars items={rows.map((r) => ({ label: r.country, value: r.count }))} tone="info" />}
    </Panel>
  );
}

/* 23–25. Concentration: sanctions authorities, space powers, cyber vendors + HHI/Gini. */
export function ConcentrationPanel({ data }: { data: DashPayload }) {
  const sanc = data.sanctions.topAuthorities;
  const space = data.spacePowers;
  const cyber = data.cyber.topVendors;
  const sancHhi = hhi(sanc.map((a) => a.count));
  const spaceHhi = hhi(space.map((a) => a.count));
  const spaceGini = gini(space.map((a) => a.count));
  return (
    <Panel title="Concentration & power" sub="HHI · Gini" wide>
      <div className="conc-grid">
        <div>
          <h4>Sanctions authorities <span className="gauge">HHI {sancHhi.toFixed(2)}</span></h4>
          <Bars items={sanc.slice(0, 5).map((a) => ({ label: a.authority, value: a.count }))} tone="risk" />
        </div>
        <div>
          <h4>Space powers <span className="gauge">HHI {spaceHhi.toFixed(2)} · Gini {spaceGini.toFixed(2)}</span></h4>
          <Bars items={space.slice(0, 5).map((a) => ({ label: a.country, value: a.count }))} tone="info" />
        </div>
        <div>
          <h4>Cyber exposure (KEV) by vendor</h4>
          <Bars items={cyber.slice(0, 5).map((a) => ({ label: a.vendor, value: a.count }))} tone="mom" />
        </div>
      </div>
      <p className="obs-note">HHI → 1 = a single actor dominates; Gini → 1 = highly unequal distribution.</p>
    </Panel>
  );
}

/* 27. Sortable, searchable full data table. */
export function DataTable({ data }: { data: DashPayload }) {
  const [sort, setSort] = useState<keyof DashScore>("risk");
  const [q, setQ] = useState("");
  const rows = useMemo(() => data.scores
    .filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0)).slice(0, 40), [data, sort, q]);
  const cols: { k: keyof DashScore; l: string }[] = [
    { k: "risk", l: "Risk" }, { k: "opportunity", l: "Opp" }, { k: "momentum", l: "Mom" }, { k: "stability", l: "Stab" },
    { k: "conflict", l: "Conf" }, { k: "disaster", l: "Dis" }, { k: "news", l: "News" }, { k: "reachPop", l: "Reach" }, { k: "space", l: "Space" },
  ];
  return (
    <Panel title="Country data table" sub={`${data.scores.length} rows`} wide>
      <input className="full" placeholder="filter countries…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Country</th>{cols.map((c) => <th key={c.k as string} className={sort === c.k ? "sorted" : ""} onClick={() => setSort(c.k)}>{c.l}</th>)}</tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.iso2}><td>{s.name}</td>{cols.map((c) => <td key={c.k as string}>{c.k === "reachPop" ? fmtBig(Number(s[c.k])) : fmt(Number(s[c.k]))}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  );
}

/* 26. Method & equations — full transparency of the maths. */
export function MethodPanel() {
  const eqs = [
    ["Risk", "0.50·conflict + 0.42·severe + 0.08·disaster  (min-max normalised)"],
    ["Opportunity", "(0.5·reach + 0.3·economy + 0.2·interest) · (0.4 + 0.6·stability)"],
    ["Momentum", "recent activity ÷ total activity"],
    ["Stability", "100 − Risk"],
    ["Risk-adjusted opp.", "opportunity ÷ (1 + risk/50)"],
    ["Expected impact", "(risk/100) × population reach"],
    ["Dependency", "Pearson r = cov(x,y) ⁄ (σx·σy)"],
    ["Similarity", "cosine = (a·b) ⁄ (‖a‖·‖b‖)"],
    ["Outlier", "z = (x − μ) ⁄ σ ; flag |z| ≥ 2"],
    ["Concentration", "HHI = Σ sᵢ² (normalised) ; Gini ∈ [0,1]"],
    ["Clusters", "k-means on the 6-D signal vector"],
    ["Frontier", "Pareto-optimal (opportunity, stability)"],
  ];
  return (
    <Panel title="Method & equations" wide>
      <table className="mini-table eqs">
        <tbody>{eqs.map(([n, e]) => <tr key={n}><td className="eq-name">{n}</td><td className="eq-body">{e}</td></tr>)}</tbody>
      </table>
      <p className="obs-note">All indices are min-max normalised across the country set, so a score is relative to what is currently observable.</p>
    </Panel>
  );
}
