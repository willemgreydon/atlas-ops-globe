"use client";
import { useState } from "react";

/** Shared 0..100 → pixel helpers keep every chart on the same coordinate logic. */
const PAD = 34;

export interface Pt { x: number; y: number; label: string; group?: number; frontier?: boolean; }

/** Scatter with quadrant guides, optional Pareto-frontier line and cluster colours. */
export function Scatter({ points, w = 540, h = 380, xLabel = "x", yLabel = "y", colors, showFrontier }: {
  points: Pt[]; w?: number; h?: number; xLabel?: string; yLabel?: string; colors?: string[]; showFrontier?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const px = (x: number) => PAD + (x / 100) * (w - PAD * 1.4);
  const py = (y: number) => h - PAD - (y / 100) * (h - PAD * 1.6);
  const front = showFrontier ? points.filter((p) => p.frontier).sort((a, b) => a.x - b.x) : [];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
      {/* quadrant guides at the 50 midlines */}
      <line x1={px(50)} y1={py(0)} x2={px(50)} y2={py(100)} className="grid" />
      <line x1={px(0)} y1={py(50)} x2={px(100)} y2={py(50)} className="grid" />
      <rect x={px(0)} y={py(100)} width={px(50) - px(0)} height={py(0) - py(50)} className="quad-good" />
      {/* axes */}
      <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(0)} className="axis" />
      <line x1={px(0)} y1={py(0)} x2={px(0)} y2={py(100)} className="axis" />
      <text x={px(50)} y={h - 6} className="axis-lbl" textAnchor="middle">{xLabel} →</text>
      <text x={10} y={py(50)} className="axis-lbl" transform={`rotate(-90 10 ${py(50)})`} textAnchor="middle">{yLabel} →</text>
      {showFrontier && front.length > 1 && (
        <polyline className="frontier" points={front.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} />
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

/** Relationship network — nodes on a ring, edges as chords, size by degree. */
export function Network({ nodes, edges, size = 340 }: {
  nodes: { id: string; label: string; weight: number }[]; edges: [number, number][]; size?: number;
}) {
  const c = size / 2, r = c - 40;
  const maxW = Math.max(1, ...nodes.map((n) => n.weight));
  const pos = nodes.map((_, i) => {
    const a = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  });
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg className="chart net" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Entity network">
      {edges.map(([a, b], i) => (
        <line key={i} x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]}
          className={`edge ${hover != null && (hover === a || hover === b) ? "hot" : ""}`} />
      ))}
      {nodes.map((n, i) => (
        <g key={n.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <circle cx={pos[i][0]} cy={pos[i][1]} r={4 + (n.weight / maxW) * 8} className={`node ${hover === i ? "hot" : ""}`} />
          {(hover === i || n.weight / maxW > 0.55) && (
            <text x={pos[i][0]} y={pos[i][1] - 10} className="node-lbl" textAnchor="middle">{n.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
