"use client";
import { useState } from "react";

/** Shared 0..100 → pixel helpers keep every chart on the same coordinate logic. */
const PAD = 34;

export interface Pt { x: number; y: number; label: string; group?: number; frontier?: boolean; }

/** Scatter with quadrant guides, optional Pareto-frontier line, OLS fit line and cluster colours. */
export function Scatter({ points, w = 540, h = 380, xLabel = "x", yLabel = "y", colors, showFrontier, fit, quadrant = true }: {
  points: Pt[]; w?: number; h?: number; xLabel?: string; yLabel?: string; colors?: string[]; showFrontier?: boolean;
  fit?: { slope: number; intercept: number }; quadrant?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const px = (x: number) => PAD + (x / 100) * (w - PAD * 1.4);
  const py = (y: number) => h - PAD - (y / 100) * (h - PAD * 1.6);
  const front = showFrontier ? points.filter((p) => p.frontier).sort((a, b) => a.x - b.x) : [];
  // Clip the regression line to the 0..100 viewport on both axes.
  const fitLine = (() => {
    if (!fit) return null;
    const yAt = (x: number) => fit.slope * x + fit.intercept;
    const pts: [number, number][] = [];
    for (const x of [0, 100]) { const y = yAt(x); if (y >= 0 && y <= 100) pts.push([x, y]); }
    for (const y of [0, 100]) { if (fit.slope !== 0) { const x = (y - fit.intercept) / fit.slope; if (x >= 0 && x <= 100) pts.push([x, y]); } }
    return pts.length >= 2 ? pts.slice(0, 2) : null;
  })();
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
      {/* quadrant guides at the 50 midlines */}
      {quadrant && <line x1={px(50)} y1={py(0)} x2={px(50)} y2={py(100)} className="grid" />}
      {quadrant && <line x1={px(0)} y1={py(50)} x2={px(100)} y2={py(50)} className="grid" />}
      {quadrant && <rect x={px(0)} y={py(100)} width={px(50) - px(0)} height={py(0) - py(50)} className="quad-good" />}
      {/* axes */}
      <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(0)} className="axis" />
      <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(100)} className="axis" />
      <text x={px(50)} y={h - 6} className="axis-lbl" textAnchor="middle">{xLabel} →</text>
      <text x={10} y={py(50)} className="axis-lbl" transform={`rotate(-90 10 ${py(50)})`} textAnchor="middle">{yLabel} →</text>
      {showFrontier && front.length > 1 && (
        <polyline className="frontier" points={front.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} />
      )}
      {fitLine && (
        <line className="fit-line" x1={px(fitLine[0][0])} y1={py(fitLine[0][1])} x2={px(fitLine[1][0])} y2={py(fitLine[1][1])} />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={hover === i ? 6 : p.frontier ? 4.5 : 3.5}
          fill={colors && p.group != null ? colors[p.group % colors.length] : "var(--accent)"}
          className={`pt ${p.frontier ? "pt-front" : ""}`}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
      {hover != null && points[hover] && (
        <g className="tip" transform={`translate(${Math.min(px(points[hover].x) + 8, w - 120)} ${py(points[hover].y) - 8})`}>
          <text className="tip-t">{points[hover].label}</text>
          <text className="tip-s" y={13}>{xLabel} {Math.round(points[hover].x)} · {yLabel} {Math.round(points[hover].y)}</text>
        </g>
      )}
    </svg>
  );
}

/** Radar / spider chart over N labelled axes, one or two 0..100 series. */
export function Radar({ axes, series, size = 240 }: {
  axes: string[]; series: { name: string; values: number[]; color: string }[]; size?: number;
}) {
  const c = size / 2;
  const r = c - 30;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (v / 100) * r;
    return [c + rr * Math.cos(a), c + rr * Math.sin(a)];
  };
  return (
    <svg className="chart radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar profile">
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} className="grid" points={axes.map((_, i) => pt(i, ring).join(",")).join(" ")} />
      ))}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 118);
        return <text key={ax} x={x} y={y} className="radar-lbl" textAnchor="middle" dominantBaseline="middle">{ax}</text>;
      })}
      {series.map((s) => (
        <polygon key={s.name} points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")}
          fill={s.color} fillOpacity={0.14} stroke={s.color} strokeWidth={1.6} />
      ))}
    </svg>
  );
}

/** Correlation heatmap: cells coloured on a −1 (red) … +1 (green) diverging scale. */
export function Heatmap({ keys, matrix, labels }: { keys: string[]; matrix: number[][]; labels?: Record<string, string> }) {
  const color = (r: number) => {
    const t = Math.abs(r);
    if (r >= 0) return `rgba(101,246,199,${0.12 + t * 0.7})`;
    return `rgba(255,90,98,${0.12 + t * 0.7})`;
  };
  const lab = (k: string) => (labels?.[k] ?? k).slice(0, 4);
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `64px repeat(${keys.length}, 1fr)` }}>
      <span />
      {keys.map((k) => <span key={k} className="hm-col" title={labels?.[k] ?? k}>{lab(k)}</span>)}
      {keys.map((k1, i) => (
        <FragmentRow key={k1}>
          <span className="hm-row" title={labels?.[k1] ?? k1}>{lab(k1)}</span>
          {keys.map((k2, j) => (
            <span key={k2} className="hm-cell" style={{ background: i === j ? "rgba(255,255,255,0.06)" : color(matrix[i][j]) }} title={`${labels?.[k1] ?? k1} ↔ ${labels?.[k2] ?? k2}: r=${matrix[i][j].toFixed(2)}`}>
              {i === j ? "" : matrix[i][j].toFixed(1)}
            </span>
          ))}
        </FragmentRow>
      ))}
    </div>
  );
}
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

/** Histogram of a sample into `bins`, with mean (accent) and median (info) marks. */
export function Histogram({ values, bins = 12, mean, median, w = 520, h = 200 }: {
  values: number[]; bins?: number; mean?: number; median?: number; w?: number; h?: number;
}) {
  if (values.length === 0) return <div className="obs-empty small">no data</div>;
  const min = Math.min(...values), max = Math.max(...values) || 1;
  const span = max - min || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor(((v - min) / span) * bins))]++;
  const maxC = Math.max(...counts) || 1;
  const bw = (w - PAD * 2) / bins;
  const xv = (v: number) => PAD + ((v - min) / span) * (w - PAD * 2);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Distribution">
      {counts.map((c, i) => (
        <rect key={i} x={PAD + i * bw + 1} y={h - PAD - (c / maxC) * (h - PAD * 1.6)} width={bw - 2}
          height={(c / maxC) * (h - PAD * 1.6)} className="bar" />
      ))}
      <line x1={PAD} y1={h - PAD} x2={w - PAD} y2={h - PAD} className="axis" />
      {mean != null && <line x1={xv(mean)} y1={PAD / 2} x2={xv(mean)} y2={h - PAD} className="mark-mean" />}
      {median != null && <line x1={xv(median)} y1={PAD / 2} x2={xv(median)} y2={h - PAD} className="mark-median" />}
      <text x={PAD} y={h - 8} className="axis-lbl">{min.toFixed(0)}</text>
      <text x={w - PAD} y={h - 8} className="axis-lbl" textAnchor="end">{max.toFixed(0)}</text>
    </svg>
  );
}

/** Horizontal labelled bars (value 0..max) — the workhorse ranking view. */
export function Bars({ items, max, unit, tone = "accent" }: { items: { label: string; value: number; hint?: string }[]; max?: number; unit?: string; tone?: string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="bars">
      {items.map((it) => (
        <li key={it.label} className="bar-row" title={it.hint}>
          <span className="bar-lbl">{it.label}</span>
          <span className={`bar-track t-${tone}`}><i style={{ width: `${Math.max(2, (it.value / m) * 100)}%` }} /></span>
          <span className="bar-val">{it.value.toLocaleString()}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

/** Entity-type → node colour. Drives both the graph and its legend. */
const KIND_COLOR: Record<string, string> = {
  person: "#65f6c7", org: "#54c7ff", organization: "#54c7ff", company: "#54c7ff",
  country: "#ffae45", place: "#ffae45", event: "#ff9db1", signal: "#b18cff",
};
const kindColor = (k?: string) => KIND_COLOR[(k || "").toLowerCase()] || "#8aa0b6";

export interface NetEdge { a: number; b: number; w?: number; tone?: "pos" | "neg"; }

/**
 * Relationship network — nodes on a ring (grouped by kind so structure reads),
 * edges as chords weighted/coloured by strength & sign, size by degree. Hover
 * an entity to trace only its links. Serves both the real entity graph and the
 * signal-dependency graph (tone = correlation sign).
 */
export function Network({ nodes, edges, size = 360, legend }: {
  nodes: { id: string; label: string; weight: number; kind?: string }[];
  edges: NetEdge[]; size?: number; legend?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (nodes.length === 0) return <div className="obs-empty small">no graph data</div>;
  // Density-adaptive geometry so the ring stays legible from ~6 up to ~200 nodes:
  // as the count climbs, shrink node radii, thin strokes, and pull the ring out
  // to use more of the canvas (labels are hover-only when dense, so less margin).
  const N = nodes.length;
  const dense = N > 80, mid = N > 40;
  const margin = dense ? 22 : mid ? 34 : 48;
  const c = size / 2, r = c - margin;
  const rBase = dense ? 1.6 : mid ? 3 : 4, rGain = dense ? 4 : mid ? 7 : 9;
  const nodeStroke = dense ? 0.6 : 1.5;
  const labelCut = dense ? 0.82 : 0.62; // only the strongest nodes carry a resting label
  const maxW = Math.max(1, ...nodes.map((n) => n.weight));
  const maxE = Math.max(1, ...edges.map((e) => e.w ?? 1));
  // Ring order: cluster same-kind nodes together, strongest first within a kind.
  const order = nodes.map((_, i) => i).sort((i, j) => {
    const ki = nodes[i].kind || "", kj = nodes[j].kind || "";
    return ki === kj ? nodes[j].weight - nodes[i].weight : ki < kj ? -1 : 1;
  });
  const slot = new Map<number, number>(); order.forEach((n, i) => slot.set(n, i));
  const pos = nodes.map((_, i) => {
    const a = (Math.PI * 2 * (slot.get(i) ?? i)) / nodes.length - Math.PI / 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  });
  const neighbours = new Set<number>();
  if (hover != null) for (const e of edges) { if (e.a === hover) neighbours.add(e.b); if (e.b === hover) neighbours.add(e.a); }
  const kinds = [...new Set(nodes.map((n) => n.kind).filter(Boolean))] as string[];
  return (
    <div className="net-wrap">
      <svg className="chart net" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Network graph">
        {edges.map((e, i) => {
          const hot = hover != null && (e.a === hover || e.b === hover);
          const dim = hover != null && !hot;
          const rgb = e.tone === "pos" ? "101,246,199" : e.tone === "neg" ? "255,90,98" : "170,190,210";
          const base = (e.tone ? 0.16 + 0.62 * ((e.w ?? 1) / maxE) : 0.12) * (dense ? 0.7 : 1);
          return (
            <line key={i} x1={pos[e.a][0]} y1={pos[e.a][1]} x2={pos[e.b][0]} y2={pos[e.b][1]}
              style={{ stroke: `rgba(${rgb},${dim ? 0.03 : hot ? 0.75 : base})`, strokeWidth: (hot ? 1.6 : dense ? 0.35 : 0.6) + ((e.w ?? 1) / maxE) * (dense ? 1.4 : 2.2) }} />
          );
        })}
        {nodes.map((n, i) => {
          const active = hover == null || hover === i || neighbours.has(i);
          return (
            <g key={n.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <circle cx={pos[i][0]} cy={pos[i][1]} r={rBase + (n.weight / maxW) * rGain}
                style={{ fill: kindColor(n.kind), opacity: active ? 1 : 0.22, stroke: "var(--bg)", strokeWidth: nodeStroke }} />
              {(hover === i || neighbours.has(i) || (hover == null && n.weight / maxW > labelCut)) && (
                <text x={pos[i][0]} y={pos[i][1] - 10} className="node-lbl" textAnchor="middle" style={{ opacity: active ? 1 : 0.3 }}>{n.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {legend && kinds.length > 0 && (
        <div className="net-legend">
          {kinds.map((k) => <span key={k}><i style={{ background: kindColor(k) }} />{k}</span>)}
        </div>
      )}
    </div>
  );
}
