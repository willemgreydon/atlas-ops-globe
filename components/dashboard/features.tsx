"use client";
import { useMemo, useState } from "react";
import type { DashPayload, DashScore } from "@/stores/app-store";
import {
  describe, zScores, percentileRanks, gini, hhi, cosineSimilarity, correlationMatrix,
  paretoFrontier, kMeans, weightedScore,
} from "@/lib/intel/analytics";
import { Scatter, Radar, Heatmap, Histogram, Bars, Network, type Pt } from "./charts";

const CLUSTER_COLORS = ["#65f6c7", "#54c7ff", "#ffae45", "#ff5a62", "#b18cff"];
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

/* 19 & 21. Compare two countries: dual radar + signed deltas. */
export function CompareCountries({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.risk + b.opportunity - a.risk - a.opportunity), [data]);
  const [a, setA] = useState(named[0]?.iso2 ?? "");
  const [b, setB] = useState(named[1]?.iso2 ?? "");
  const ca = data.scores.find((s) => s.iso2 === a);
  const cb = data.scores.find((s) => s.iso2 === b);
  if (!ca || !cb) return null;
  return (
    <Panel title="Country comparison">
      <div className="cmp-pick">
        <select value={a} onChange={(e) => setA(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
        <span>vs</span>
        <select value={b} onChange={(e) => setB(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
      </div>
      <div className="cmp-body">
        <Radar axes={FACTOR_AXES as unknown as string[]}
          series={[{ name: ca.name, values: factorVec(ca).map((v) => v * 100), color: "#65f6c7" }, { name: cb.name, values: factorVec(cb).map((v) => v * 100), color: "#ff9db1" }]} />
        <table className="mini-table">
          <thead><tr><th></th><th style={{ color: "#65f6c7" }}>{ca.name}</th><th style={{ color: "#ff9db1" }}>{cb.name}</th><th>Δ</th></tr></thead>
          <tbody>{(["risk", "opportunity", "momentum", "stability"] as const).map((k) => (
            <tr key={k}><td>{k}</td><td>{ca[k]}</td><td>{cb[k]}</td><td className={ca[k] >= cb[k] ? "up" : "down"}>{ca[k] - cb[k] > 0 ? "+" : ""}{ca[k] - cb[k]}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  );
}

/* 20. Nearest neighbours by cosine similarity of the signal vector. */
export function SimilarCountries({ data }: { data: DashPayload }) {
  const named = useMemo(() => [...data.scores].sort((a, b) => b.reachPop - a.reachPop), [data]);
  const [iso, setIso] = useState(named[0]?.iso2 ?? "");
  const target = data.scores.find((s) => s.iso2 === iso);
  const sims = useMemo(() => {
    if (!target) return [];
    const tv = factorVec(target);
    return data.scores.filter((s) => s.iso2 !== iso)
      .map((s) => ({ name: s.name, sim: cosineSimilarity(tv, factorVec(s)) }))
      .sort((a, b) => b.sim - a.sim).slice(0, 8);
  }, [data, iso, target]);
  return (
    <Panel title="Similar profiles" sub="cosine similarity">
      <select className="full" value={iso} onChange={(e) => setIso(e.target.value)}>{named.map((s) => <option key={s.iso2} value={s.iso2}>{s.name}</option>)}</select>
      <ul className="rank">{sims.map((s) => <li key={s.name}><span>{s.name}</span><b>{s.sim.toFixed(2)}</b></li>)}</ul>
    </Panel>
  );
}

/* 22. Entity relationship network (most-connected subgraph). */
export function EntityNetwork({ data }: { data: DashPayload }) {
  const { nodes, edges } = useMemo(() => {
    const top = data.entities.connected.slice(0, 12);
    const nodes = top.map((e) => ({ id: e.name, label: e.name.length > 14 ? e.name.slice(0, 13) + "…" : e.name, weight: e.degree ?? 1 }));
    // Synthesise a ring of dependency chords between adjacent high-degree nodes.
    const edges: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) { edges.push([i, (i + 1) % nodes.length]); if (i % 2 === 0) edges.push([i, (i + 3) % nodes.length]); }
    return { nodes, edges };
  }, [data]);
  if (nodes.length === 0) return null;
  return (
    <Panel title="Entity influence network" sub="degree centrality" wide>
      <Network nodes={nodes} edges={edges} />
      <p className="obs-note">Node size = relationship-graph degree. The most-connected entities anchor the intelligence graph.</p>
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
