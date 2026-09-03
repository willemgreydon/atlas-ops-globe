"use client";
import { useMemo, useState } from "react";
import { useApp, type DashInsight, type DashPayload, type DashScore } from "@/stores/app-store";

type Persona = "all" | "political" | "finance" | "marketing";
const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: "all", label: "All", blurb: "Every lens, ranked by signal strength" },
  { id: "political", label: "Political", blurb: "Hotspots, escalation, sanctions, influence" },
  { id: "finance", label: "Finance", blurb: "Market movers, exposure, cyber, supply-chain risk" },
  { id: "marketing", label: "Marketing", blurb: "Reach, opportunity markets, trending topics" },
];

/** Default leaderboard metric per persona. */
const LEAD_METRIC: Record<Persona, keyof Pick<DashScore, "risk" | "opportunity" | "momentum">> = {
  all: "risk", political: "risk", finance: "risk", marketing: "opportunity",
};

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtM = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`);

export default function Observatory() {
  const app = useApp();
  const { data, loading, error } = app.dashboard;
  const [persona, setPersona] = useState<Persona>("all");

  if (error || (data && data.degraded)) {
    return (
      <div className="observatory">
        <ObsHeader persona={persona} setPersona={setPersona} generatedAt={data?.generatedAt} status="degraded" />
        <div className="obs-empty">
          Analytics unavailable — the intelligence vault is temporarily unreadable (read-quota / cold replica).
          Live layers on the globe are unaffected.
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="observatory">
        <ObsHeader persona={persona} setPersona={setPersona} status={loading ? "loading" : undefined} />
        <div className="obs-empty">{loading ? "Computing cross-domain analytics…" : "No analytics yet."}</div>
      </div>
    );
  }

  return (
    <div className="observatory">
      <ObsHeader persona={persona} setPersona={setPersona} generatedAt={data.generatedAt} status={data.status} />
      {data.coverage?.hazardOnly && (
        <div className="obs-caveat">
          <b>Coverage note:</b> no live conflict data in the vault right now, so <b>Risk</b> reflects
          natural-hazard <i>severity</i> (earthquakes, storms, fires), not political conflict. Opportunity,
          reach and entity signals are unaffected. Political-conflict scoring resumes when the conflict feed is live.
        </div>
      )}
      <Kpis data={data} persona={persona} />
      <div className="obs-grid">
        <InsightFeed data={data} persona={persona} />
        <div className="obs-side">
          <Leaderboard data={data} persona={persona} />
          <Dependencies data={data} />
          <Influence data={data} />
        </div>
      </div>
    </div>
  );
}

function ObsHeader({ persona, setPersona, generatedAt, status }: { persona: Persona; setPersona: (p: Persona) => void; generatedAt?: string; status?: string }) {
  return (
    <div className="obs-head">
      <div className="obs-title">
        <h2>OBSERVATORY</h2>
        <span className="obs-sub">Cross-domain risk · opportunity · dependency intelligence</span>
      </div>
      <div className="obs-persona" role="group" aria-label="Persona lens">
        {PERSONAS.map((p) => (
          <button key={p.id} className={persona === p.id ? "active" : ""} onClick={() => setPersona(p.id)} title={p.blurb} aria-pressed={persona === p.id}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="obs-meta">
        {status && <span className={`obs-status s-${status}`}>{status}</span>}
        {generatedAt && <span className="obs-time">{new Date(generatedAt).toISOString().slice(11, 19)} UTC</span>}
      </div>
    </div>
  );
}

function Kpis({ data, persona }: { data: DashPayload; persona: Persona }) {
  const k = useMemo(() => {
    const byRisk = [...data.scores].sort((a, b) => b.risk - a.risk);
    const byOpp = [...data.scores].sort((a, b) => b.opportunity - a.opportunity);
    const hotspots = data.scores.filter((s) => s.risk >= 60).length;
    const mover = [...data.markets].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
    const clean = data.scores.filter((s) => s.opportunity >= 40 && s.risk <= 30).length;
    return { topRisk: byRisk[0], topOpp: byOpp[0], hotspots, mover, clean };
  }, [data]);

  const tiles: { label: string; value: string; sub?: string; tone?: string }[] = [];
  tiles.push({ label: "Top risk", value: k.topRisk?.name ?? "—", sub: k.topRisk ? `${k.topRisk.risk}/100` : undefined, tone: "risk" });
  tiles.push({ label: "Active hotspots", value: String(k.hotspots), sub: "risk ≥ 60", tone: "risk" });
  tiles.push({ label: "Top opportunity", value: k.topOpp?.name ?? "—", sub: k.topOpp ? `${k.topOpp.opportunity}/100` : undefined, tone: "opp" });
  if (persona === "finance" || persona === "all") {
    tiles.push({ label: "Top mover", value: k.mover ? `${k.mover.name}` : "—", sub: k.mover ? `${k.mover.changePct >= 0 ? "▲" : "▼"} ${Math.abs(k.mover.changePct).toFixed(2)}%` : "markets closed", tone: k.mover && k.mover.changePct < 0 ? "risk" : "opp" });
    tiles.push({ label: "Exploited CVEs", value: fmt(data.cyber.kev), sub: `of ${fmt(data.cyber.total)}`, tone: "risk" });
  } else if (persona === "marketing") {
    tiles.push({ label: "Clean growth markets", value: String(k.clean), sub: "high reach · low risk", tone: "opp" });
    tiles.push({ label: "Trending orgs", value: String(data.entities.organizations.length), sub: "in the news graph" });
  } else {
    tiles.push({ label: "Sanctions in force", value: fmt(data.sanctions.total), tone: "risk" });
    tiles.push({ label: "Tracked entities", value: fmt((data.counts.persons ?? 0) + (data.counts.organizations ?? 0)), sub: "persons + orgs" });
  }

  return (
    <div className="obs-kpis">
      {tiles.map((t) => (
        <div key={t.label} className={`kpi ${t.tone ?? ""}`}>
          <span className="kpi-label">{t.label}</span>
          <span className="kpi-value">{t.value}</span>
          {t.sub && <span className="kpi-sub">{t.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function InsightFeed({ data, persona }: { data: DashPayload; persona: Persona }) {
  const list = useMemo(() => {
    const items = persona === "all" ? data.insights : data.insights.filter((i) => i.persona === persona);
    return items.slice(0, 24);
  }, [data, persona]);
  return (
    <div className="obs-panel obs-insights">
      <h3>Signals & insights {persona !== "all" && <em>· {persona}</em>}</h3>
      {list.length === 0 && <div className="obs-empty small">No insights for this lens yet.</div>}
      <ul className="insight-list">
        {list.map((i) => <InsightCard key={i.id} i={i} showPersona={persona === "all"} />)}
      </ul>
    </div>
  );
}

function InsightCard({ i, showPersona }: { i: DashInsight; showPersona: boolean }) {
  return (
    <li className={`insight k-${i.kind}`}>
      <div className="insight-top">
        <span className={`chip c-${i.kind}`}>{i.kind}</span>
        {showPersona && <span className="chip c-persona">{i.persona}</span>}
        <span className="insight-title">{i.title}</span>
      </div>
      <p className="insight-detail">{i.detail}</p>
      {i.metrics.length > 0 && (
        <div className="insight-metrics">
          {i.metrics.map((m, n) => (
            <span key={n} className="metric"><b>{m.value}</b> {m.label}</span>
          ))}
        </div>
      )}
    </li>
  );
}

function Leaderboard({ data, persona }: { data: DashPayload; persona: Persona }) {
  const [metric, setMetric] = useState<keyof Pick<DashScore, "risk" | "opportunity" | "momentum">>(LEAD_METRIC[persona]);
  const rows = useMemo(() => [...data.scores].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 12), [data, metric]);
  return (
    <div className="obs-panel">
      <div className="panel-head">
        <h3>Country leaderboard</h3>
        <div className="seg small">
          {(["risk", "opportunity", "momentum"] as const).map((m) => (
            <button key={m} className={metric === m ? "active" : ""} onClick={() => setMetric(m)}>{m === "opportunity" ? "opp" : m}</button>
          ))}
        </div>
      </div>
      <ul className="lead-list">
        {rows.map((s) => (
          <li key={s.iso2} className="lead-row">
            <span className="lead-name" title={s.region}>{s.name}</span>
            <span className={`lead-bar ${metric}`}><i style={{ width: `${Math.max(2, s[metric] as number)}%` }} /></span>
            <span className="lead-val">{s[metric] as number}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dependencies({ data }: { data: DashPayload }) {
  return (
    <div className="obs-panel">
      <h3>Cross-domain dependencies</h3>
      <ul className="corr-list">
        {data.correlations.map((c) => {
          const strong = Math.abs(c.r) >= 0.5;
          const tone = c.r >= 0 ? "pos" : "neg";
          return (
            <li key={c.label} className="corr-row">
              <span className="corr-label">{c.label}</span>
              <span className={`corr-r ${tone} ${strong ? "strong" : ""}`}>r = {c.r.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>
      <p className="obs-note">Pearson correlation across {data.scores.length} countries. |r| ≥ 0.5 = strong co-movement.</p>
    </div>
  );
}

function Influence({ data }: { data: DashPayload }) {
  return (
    <div className="obs-panel">
      <h3>Entity influence</h3>
      <div className="infl-cols">
        <div>
          <h4>Most connected</h4>
          <ul className="infl-list">
            {data.entities.connected.slice(0, 6).map((e) => (
              <li key={e.name}><span>{e.name}</span><b>{e.degree ?? 0}</b></li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Top mentioned</h4>
          <ul className="infl-list">
            {data.entities.persons.slice(0, 6).map((e) => (
              <li key={e.name}><span>{e.name}</span><b>{e.mentions}</b></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
